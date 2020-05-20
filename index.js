var express = require("express");
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
const { v4: uuidv4 } = require("uuid");

var games = [];

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/lobby", (req, res) => {
  res.sendFile(__dirname + "/lobby.html");
});

function joinGame(socket, game, name) {
  game.sockets.push(socket);
  socket.join(game.gameID, () => {
    socket.gameID = game.gameID;
    socket.name = name;
    console.log(
      name + " with socket ID " + socket.id + " joined " + game.gameID
    );
  });
}

function getPlayersInGame(game) {
  names = [];
  for (let i = 0; i < game.sockets.length; i++) {
    names.push(game.sockets[i].name);
  }

  return names;
}

function sendToAllPlayersInGame(game, msg, msgType) {
  for (let i = 0; i < game.sockets.length; i++) {
    let socket = game.sockets[i];
    socket.emit(msgType, msg);
  }
}

function sendToGameOwner(game, msg, msgType) {
  game.owner.emit(msgType, msg);
}

function sendToNthPlayer(game, n, msg, msgType) {
  game.sockets[n].emit(msgType, msg);
}

function getRandom(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len);
  if (n > len)
    throw new RangeError("getRandom: more elements taken than available");
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}

Array.prototype.remove = function () {
  var what,
    a = arguments,
    L = a.length,
    ax;
  while (L && this.length) {
    what = a[--L];
    while ((ax = this.indexOf(what)) !== -1) {
      this.splice(ax, 1);
    }
  }
  return this;
};

// welcome room
io.on("connection", (socket) => {
  // when someone disconnects, remove them from the game they are in and update lobby
  socket.on("disconnect", () => {
    console.log("socket disconnection");
    console.log(socket.gameID);
    if (socket.gameID in games && games[socket.gameID].sockets.length !== 0) {
      games[socket.gameID].sockets.remove(socket);
      playerNames = getPlayersInGame(games[socket.gameID]);
      sendToAllPlayersInGame(games[socket.gameID], playerNames, "lobby update");

      if (games[socket.gameID].sockets.length % 2 !== 0) {
        console.log("not ready to start anymore");
        sendToGameOwner(
          games[socket.gameID],
          "not ready to start",
          "not ready to start"
        );
      } else {
        sendToGameOwner(
          games[socket.gameID],
          "ready to start",
          "ready to start"
        );
      }
    }
  });

  // handle start game request
  socket.on("start request", (data) => {
    cards = [];
    for (let i = 1; i <= 40; i++) {
      cards.push(i);
    }
    const game = {
      gameID: uuidv4(),
      name: "game" + parseInt(games.length + 1),
      owner: socket,
      sockets: [],
      started: false,
      currentPlayer: 0,
      deck: cards,
      storyText: "",
      cardsOnBoard: [],
    };
    games[game.gameID] = game;

    joinGame(socket, game, data.name);

    // emit confirmation back to client
    socket.emit("start success", { gameID: game.gameID });
  });

  // handle join game request
  socket.on("join request", (data) => {
    var gameID = data.gameID;
    if (gameID in games) {
      if (games[gameID].sockets.length < 4 && games[gameID].started === false) {
        const game = games[gameID];
        joinGame(socket, game, data.name);

        // emit confirmation back to client
        socket.emit("join success", {
          gameID: data.gameID,
        });
      } else if (games[gameID].sockets.length === 4) {
        socket.emit("join failure", "game full");
      } else if (games[gameID].started === true) {
        socket.emit("join failure", "game already started");
      }
    } else {
      // emit no game with that gameID exists back to client
      socket.emit("join failure", "gameID does not exist");
    }
  });

  // send updated player list to people in the lobby
  socket.on("entered lobby", (data) => {
    // let everyone in the game room know about the updated list
    playerNames = getPlayersInGame(games[data.gameID]);
    sendToAllPlayersInGame(games[socket.gameID], playerNames, "lobby update");

    // if game has 4 players, give the owner the option to start the game
    if (games[socket.gameID].sockets.length % 2 === 0) {
      console.log("ready to start");
      sendToGameOwner(games[socket.gameID], "ready to start", "ready to start");
    }
  });

  // start a game
  socket.on("start game", (data) => {
    games[socket.gameID].started = true;

    var deal = getRandom(games[socket.gameID].deck, 16);

    console.log(games[socket.gameID].deck);
    console.log(deal);

    games[socket.gameID].deck = games[socket.gameID].deck.filter(
      (value) => !deal.includes(value)
    );
    console.log(games[socket.gameID].deck);

    for (let i = 0; i < games[socket.gameID].sockets.length; i++) {
      startingCards = deal.slice(4 * i, 4 * (i + 1));
      sendToNthPlayer(
        games[socket.gameID],
        i,
        {
          startingCards: startingCards,
          currentPlayerName: games[socket.gameID].sockets[0].name,
        },
        "game started"
      );
    }

    sendToNthPlayer(
      games[socket.gameID],
      games[socket.gameID].currentPlayer,
      "your turn",
      "your turn"
    );
  });

  // handle player submitting their turn
  socket.on("submit turn", (data) => {
    var name = data.name;
    var cardNum = data.cardNum;
    var text = data.text;

    console.log(
      name + " submitted turn with cardNum: " + cardNum + " and text: " + text
    );

    // update game data (text, cards on board, currentPlayer)
    games[socket.gameID].storyText += text + " ";
    games[socket.gameID].cardsOnBoard.push(parseInt(cardNum));
    games[socket.gameID].currentPlayer =
      (games[socket.gameID].currentPlayer + 1) %
      games[socket.gameID].sockets.length;

    console.log(games[socket.gameID].deck);

    // deal a new random card to the person who just submitted their turn
    var newCard = getRandom(games[socket.gameID].deck, 1);
    games[socket.gameID].deck.remove(parseInt(newCard));
    socket.emit("dealt card", {
      oldCard: cardNum,
      newCard: newCard,
    });

    console.log(games[socket.gameID].deck);

    // update everyone in the game about the updated cards on board and game text
    sendToAllPlayersInGame(
      games[socket.gameID],
      {
        cardsOnBoard: games[socket.gameID].cardsOnBoard,
        text: games[socket.gameID].storyText,
        currentPlayerName:
          games[socket.gameID].sockets[games[socket.gameID].currentPlayer].name,
      },
      "update board"
    );

    // signal the next player that it is their turn
    sendToNthPlayer(
      games[socket.gameID],
      games[socket.gameID].currentPlayer,
      "your turn",
      "your turn"
    );
  });
});

http.listen(3000, () => {
  console.log("listening on *:3000");
});
