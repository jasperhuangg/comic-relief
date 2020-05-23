var socket = io();

/* --------------------------------------------------------------------------------WELCOME-------------------------------------------------------------------------------- */

$("#join").on("click", function (e) {
  e.preventDefault();
  var name = $("#name").val();
  var gameID = $("#gameID").val();
  if (name.length > 0 && gameID.length > 0) {
    socket.emit("join request", {
      name: name,
      gameID: gameID,
    });
  }
});

$("#start").on("click", function (e) {
  e.preventDefault();
  var name = $("#name").val();
  if (name.length > 0) {
    socket.emit("start request", {
      name: name,
    });
  }
});

// game confirmation
socket.on("start success", function (data) {
  sessionStorage.setItem("gameID", data.gameID);
  sessionStorage.setItem("name", $("#name").val());
  $(".gameID").html(sessionStorage.getItem("gameID"));

  $("#welcome-section").addClass("d-none");
  $("#lobby-section").removeClass("d-none");

  socket.emit("entered lobby", {
    name: sessionStorage.getItem("name"),
    gameID: sessionStorage.getItem("gameID"),
  });
});

socket.on("join success", function (data) {
  sessionStorage.setItem("gameID", data.gameID);
  sessionStorage.setItem("name", $("#name").val());
  $(".gameID").html(sessionStorage.getItem("gameID"));

  $("#welcome-section").addClass("d-none");
  $("#lobby-section").removeClass("d-none");

  socket.emit("entered lobby", {
    name: sessionStorage.getItem("name"),
    gameID: sessionStorage.getItem("gameID"),
  });
});

socket.on("join failure", function (data) {
  alert(data);
});

/* --------------------------------------------------------------------------------LOBBY-------------------------------------------------------------------------------- */

socket.on("lobby update", function (data) {
  updateLobbyPlayerList(data);
});

socket.on("ready to start", function (data) {
  $("#start-button").removeAttr("disabled");
});

socket.on("not ready to start", function (data) {
  $("#start-button").attr("disabled", "");
});

function updateLobbyPlayerList(players) {
  var listHTML = "";

  for (let i = 0; i < players.length; i++) {
    listHTML +=
      "<li class='list-group-item color" + i + "'>" + players[i] + "</li>";
  }

  $("#player-list").html(listHTML);
}

// handle click to copy game ID
function copyToClipboard(value) {
  const el = document.createElement("textarea");
  el.value = value;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

$(".gameID").on("click", function () {
  let val = $(".gameID").html();
  $("#click-to-copy").html("(copied!)");
  setTimeout(function () {
    $("#click-to-copy").html("(click to copy)");
  }, 5000);

  copyToClipboard(val);
});

$("#start-button").on("click", function () {
  socket.emit("start game", {
    gameID: $(".gameID").html(),
  });
});

/* --------------------------------------------------------------------------------GAMEPLAY-------------------------------------------------------------------------------- */

function setStoryHeight() {
  let boardHeight = $(".grid").height();
  $("#story").height(boardHeight * 0.4);
}

socket.on("game started", function (data) {
  // display the game section
  $("#lobby-section").addClass("d-none");
  setStoryHeight();
  $("#game-section").removeClass("d-none");
  setStoryHeight();

  // set their typing and button color
  $("#sentence-input").addClass("color" + data.playerNumber);
  $("#submit-end-turn").addClass("buttonColor" + data.playerNumber);
  $("#proceed-to-voting").addClass("buttonColor" + data.playerNumber);
  $("#player-number").html(data.playerNumber);

  // deal the 4 starting cards given by the server
  $(".player-card").each(function (index) {
    $(this)
      .children("img")
      .attr("src", "./assets/Card" + data.startingCards[index] + ".png");
  });

  $("#current-player-name").html(data.currentPlayerName + "'s");
});

$(document).ready(function () {
  setStoryHeight();
});

$(document).ready(function () {
  if (screen.width <= 768) {
    $("#welcome-section").addClass("d-none");
    $("#not-supported-section").removeClass("d-none");
  } else if (screen.width > 768) {
    $("#welcome-section").removeClass("d-none");
    $("#not-supported-section").addClass("d-none");
  }
});

$(window).resize(function () {
  if (screen.width <= 768) {
    $("#welcome-section").addClass("d-none");
    $("#lobby-section").addClass("d-none");
    $("#post-game-section").addClass("d-none");
    $("#game-section").addClass("d-none");
    $("#summary-section").addClass("d-none");
    $("#not-supported-section").removeClass("d-none");
  }
  setStoryHeight();
});

socket.on("your turn", function (data) {
  if ($("#proceed-to-voting").hasClass("d-none")) {
    $("#sentence-input").removeAttr("disabled");
    $("#sentence-input").focus();
    $("#submit-end-turn").removeAttr("disabled");
    $("#current-player-name").html("your");
  }
});

$(".player-card").on("click", function () {
  if ($("#current-player-name").html() === "your") {
    $(document)
      .find(".player-card")
      .each(function () {
        $(this).children("img").css("border", "none");
      });
    var colorHex = $(".color" + $("#player-number").html()).css("color");
    $(this)
      .children("img")
      .css("border", "solid 6px " + colorHex);
    var periodIndex = $(this).children("img").attr("src").search("png") - 1;
    $(this)
      .parent()
      .find("#selected-card")
      .html($(this).children("img").attr("src").substring(13, periodIndex));
  }
});

$("#submit-end-turn").on("click", function () {
  var cardNum = $("#selected-card").html(); // get selected card #

  var text = $("#sentence-input").val(); // get sentence-input text

  var numWords = countWords(text);

  if (cardNum !== "" && text !== "" && numWords <= 20) {
    socket.emit("submit turn", {
      name: sessionStorage.getItem("name"),
      cardNum: cardNum,
      text: text,
    });
    $("#sentence-input").val("");
    $(document)
      .find(".player-card")
      .each(function () {
        $(this).children("img").css("border", "none");
      });
    $("#selected-card").html("");
    $("#num-words-left").html("20");
  } else if (cardNum === "" || text === "") {
    alert("Please type your part of the story AND select a card!");
  } else {
    alert("Too many words!");
  }
});

// deal the new card to the player
socket.on("dealt card", function (data) {
  var oldCard = "./assets/Card" + data.oldCard + ".png";
  var newCard = "./assets/Card" + data.newCard + ".png";

  $(".player-card").each(function () {
    if ($(this).children("img").attr("src") === oldCard) {
      $(this).children("img").attr("src", newCard);
    }
  });
  $("#sentence-input").attr("disabled", "");
  $("#submit-end-turn").attr("disabled", "");
});

socket.on("update board", function (data) {
  var cardsOnBoard = data.cardsOnBoard;
  var storyText = data.text;
  $("#story").html(storyText);

  $(document)
    .find(".box")
    .each(function (index) {
      // break out when we run out of cards in the updated board
      if (index === cardsOnBoard.length) {
        return false;
      }
      var card = "./assets/Card" + cardsOnBoard[index] + ".png";
      $(this).css("background-image", "url('" + card + "')");
    });

  $("#current-player-name").html(data.currentPlayerName + "'s");

  // scroll to the bottom of the textarea
  $("#story").scrollTop($("#story")[0].scrollHeight);

  var sfx = document.getElementById("update");
  sfx.play();

  if (data.cardsOnBoard.length === 16) {
    // disable all inputs
    $("#sentence-input").attr("disabled", "");
    $("#submit-end-turn").attr("disabled", "");

    $("#submit-end-turn").addClass("d-none"); // hide the submit button
    $("#proceed-to-voting").removeClass("d-none"); // show the proceed to voting button

    // change the player turn prompt text
    $("#turn-prompt").html("(Story complete!)");

    // copy everything in the board and the story text to the voting section
    $("#voting-board").html($(".grid").html());
    $("#voting-story").html($("#story").html());

    alert("Congratulations, your team has completed your story!");
  }
});

function countWords(str) {
  if (str == "" || str == undefined || str == null) {
    return 0;
  }
  str = str.replace(/(^\s*)|(\s*$)/gi, "");
  str = str.replace(/[ ]{2,}/gi, " ");
  str = str.replace(/\n /, "\n");
  return str.split(" ").length;
}

// provide count of number of words
$("#sentence-input").on("input", function () {
  var input = $("#sentence-input").val();

  var wordCount = countWords(input);

  var numWordsLeft = 20 - wordCount;

  $("#num-words-left").html(numWordsLeft);

  if (numWordsLeft < 0 && !$("#words-info").hasClass("text-danger")) {
    $("#words-info").addClass("text-danger");
  } else if ($("#words-info").hasClass("text-danger")) {
    $("#words-info").removeClass("text-danger");
  }
});

/* --------------------------------------------------------------------------------VOTING-------------------------------------------------------------------------------- */

$("#proceed-to-voting").on("click", function () {
  $("#game-section").addClass("d-none"); // hide the game section

  $("#post-game-section").removeClass("d-none"); // show the post-game-section
});

socket.on("proceed to voting", function (data) {});

voteChoices = [];

$("#voting-board").on("click", ".box", function () {
  if (voteChoices.length !== 3) {
    var choiceNum = $(".box").index($(this)) - 16; // offset by 16 for .box in game section board

    // push panel # into vote choices
    voteChoices.push(choiceNum);

    // unhide the right voting token depending on vote choices length
    // send the vote to the server to update other players' boards
    if (voteChoices.length === 1) {
      socket.emit("vote", {
        name: sessionStorage.getItem("name"),
        category: "funniest",
        panelNum: choiceNum,
      });
      $("#vote-adjective").html("Most Pivotal");
    } else if (voteChoices.length === 2) {
      socket.emit("vote", {
        name: sessionStorage.getItem("name"),
        category: "pivotal",
        panelNum: choiceNum,
      });
      $("#vote-adjective").html("'Best Save'");
    } else {
      socket.emit("vote", {
        name: sessionStorage.getItem("name"),
        category: "best save",
        panelNum: choiceNum,
      });
      $("#voting-prompt-text").html(
        "Waiting for other players to finish voting..."
      );
      $("#voting-instructions").addClass("d-none");
    }

    $("html, body").animate({ scrollTop: 0 }, "fast");
  }
});

$("#voting-board").on("mouseenter", ".box", function () {
  var rowIndex = $(this).parent().index();
  var index = $(this).index() + 4 * rowIndex;
  $("#voting-story")
    .find(".cardMatch" + index)
    .css("background-color", "#545f6b");
});

$("#voting-board").on("mouseleave", ".box", function () {
  var rowIndex = $(this).parent().index();
  var index = $(this).index() + 4 * rowIndex;
  $("#voting-story")
    .find(".cardMatch" + index)
    .css("background-color", "transparent");
});

socket.on("vote update", (data) => {
  addVoteTokenToPanel(
    $(".box").eq(data.panelNum + 16),
    data.category,
    data.playerNumber
  );
});

function addVoteTokenToPanel(panelObject, tokenType, playerNumber) {
  var colorHex;
  if (playerNumber === 0) {
    colorHex = "#65c8e6 !important";
  } else if (playerNumber === 1) {
    colorHex = "#a0acd9 !important";
  } else if (playerNumber === 2) {
    colorHex = "#86c2b6 !important";
  } else if (playerNumber === 3) {
    colorHex = "#dba49e !important";
  }

  if (tokenType === "funniest") {
    var oldHTML = panelObject.find(".inner").html();
    panelObject
      .find(".inner")
      .html(
        oldHTML +
          `<img class="col-4 voting-token smaller-bottom-margin" src="./assets/0-funniest.png" style="background-color:` +
          colorHex +
          `">`
      );
  } else if (tokenType === "best save") {
    var oldHTML = panelObject.find(".inner").html();
    panelObject
      .find(".inner")
      .html(
        oldHTML +
          `<img class="col-4 voting-token smaller-bottom-margin" src="./assets/0-bestsave.png" style="background-color:` +
          colorHex +
          `">`
      );
  } else if (tokenType === "pivotal") {
    var oldHTML = panelObject.find(".inner").html();
    panelObject
      .find(".inner")
      .html(
        oldHTML +
          `<img class="col-4 voting-token smaller-bottom-margin" src="./assets/0-pivot.png" style="background-color:` +
          colorHex +
          `">`
      );
  }
}

/* --------------------------------------------------------------------------------SUMMARY-------------------------------------------------------------------------------- */

socket.on("all votes submitted", (data) => {
  // create the summary page
  var funniestPanelPlayers = [];
  var pivotalPanelPlayers = [];
  var bestSavePanelPlayers = [];

  // get the player names
  for (let i = 0; i < data.funniestTop.length; i++) {
    funniestPanelPlayers.push(
      data.playerNames[data.funniestTop[i] % data.playerNames.length]
    );
  }

  for (let i = 0; i < data.pivotalTop.length; i++) {
    pivotalPanelPlayers.push(
      data.playerNames[data.pivotalTop[i] % data.playerNames.length]
    );
  }

  for (let i = 0; i < data.bestSaveTop.length; i++) {
    bestSavePanelPlayers.push(
      data.playerNames[data.bestSaveTop[i] % data.playerNames.length]
    );
  }

  var funniestPanelCardImgURLs = [];
  var pivotalPanelCardImgURLs = [];
  var bestSavePanelCardImgURLs = [];

  // get the card img URLs
  for (let i = 0; i < data.funniestTop.length; i++) {
    var cardObject = $("#voting-board").find(".box").eq(data.funniestTop[i]);
    var cardImgURL = cardObject.css("background-image");
    funniestPanelCardImgURLs.push(cardImgURL);
  }

  for (let i = 0; i < data.pivotalTop.length; i++) {
    var cardObject = $("#voting-board").find(".box").eq(data.pivotalTop[i]);
    var cardImgURL = cardObject.css("background-image");
    pivotalPanelCardImgURLs.push(cardImgURL);
  }

  for (let i = 0; i < data.bestSaveTop.length; i++) {
    var cardObject = $("#voting-board").find(".box").eq(data.bestSaveTop[i]);
    var cardImgURL = cardObject.css("background-image");
    bestSavePanelCardImgURLs.push(cardImgURL);
  }

  var funniestPanelTexts = [];
  var pivotalPanelTexts = [];
  var bestSavePanelTexts = [];

  for (let i = 0; i < data.funniestTop.length; i++) {
    var text = $("#voting-story")
      .find(".cardMatch" + data.funniestTop[i])
      .html();
    funniestPanelTexts.push(text);
  }

  for (let i = 0; i < data.pivotalTop.length; i++) {
    var text = $("#voting-story")
      .find(".cardMatch" + data.pivotalTop[i])
      .html();
    pivotalPanelTexts.push(text);
  }

  for (let i = 0; i < data.bestSaveTop.length; i++) {
    var text = $("#voting-story")
      .find(".cardMatch" + data.bestSaveTop[i])
      .html();
    bestSavePanelTexts.push(text);
  }

  for (let i = 0; i < data.funniestTop.length; i++) {
    var innerHTML =
      `        
      <div class="col-3 row">
        <div class="box summary-box" style='background-image: ` +
      funniestPanelCardImgURLs[i] +
      `;'></div>
      </div>
      <div class="col-5 font-italic color` +
      data.playerNames.indexOf(funniestPanelPlayers[i]) +
      `">'` +
      funniestPanelTexts[i] +
      `'</div>
      <div class="col-4 color` +
      data.playerNames.indexOf(funniestPanelPlayers[i]) +
      `">Played by: <span>` +
      funniestPanelPlayers[i] +
      `</span></div>
    `;
    $("#funniest-section").append(innerHTML);
  }

  for (let i = 0; i < data.pivotalTop.length; i++) {
    var innerHTML =
      `        
      <div class="col-3 row">
        <div class="box summary-box" style='background-image: ` +
      pivotalPanelCardImgURLs[i] +
      `;'></div>
      </div>
      <div class="col-5 font-italic color` +
      data.playerNames.indexOf(pivotalPanelPlayers[i]) +
      `">'` +
      pivotalPanelTexts[i] +
      `'</div>
      <div class="col-4 color` +
      data.playerNames.indexOf(pivotalPanelPlayers[i]) +
      `">Played by: <span>` +
      pivotalPanelPlayers[i] +
      `</span></div>
    `;
    $("#most-pivotal-section").append(innerHTML);
  }

  for (let i = 0; i < data.bestSaveTop.length; i++) {
    var innerHTML =
      `        
      <div class="col-3 row">
        <div class="box summary-box" style='background-image: ` +
      bestSavePanelCardImgURLs[i] +
      `;'></div>
      </div>
      <div class="col-5 font-italic color` +
      data.playerNames.indexOf(bestSavePanelPlayers[i]) +
      `">'` +
      bestSavePanelTexts[i] +
      `'</div>
      <div class="col-4 color` +
      data.playerNames.indexOf(bestSavePanelPlayers[i]) +
      `">Played by: <span>` +
      bestSavePanelPlayers[i] +
      `</span></div>
    `;
    $("#best-save-section").append(innerHTML);
  }

  // redirect to summary page
  $("#post-game-section").addClass("d-none");
  $("#summary-section").removeClass("d-none");
});
