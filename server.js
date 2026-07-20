const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function createInitialState(count = 4) {
  const players = {};
  for (let i = 1; i <= count; i++) {
    const commanderDamage = {};
    for (let j = 1; j <= count; j++) {
      if (i !== j) {
        commanderDamage[j] = 0;
      }
    }
    players[i] = {
      name: `Player ${i}`,
      life: 40,
      poison: 0,
      commanderDamage,
      commanderInfo: null
    };
  }

  // 先攻プレイヤー（Starting Player）をランダム決定
  const firstPlayerId = Math.floor(Math.random() * count) + 1;

  return {
    activePlayerCount: count,
    firstPlayerId,
    players
  };
}

let gameState = createInitialState(4);

wss.on('connection', (ws) => {
  console.log('クライアントが接続しました。');

  ws.send(JSON.stringify({
    type: 'init',
    state: gameState
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'update') {
        const { playerId, field, value, subPlayerId } = data;
        
        if (gameState.players && gameState.players[playerId] !== undefined) {
          if (field === 'life') {
            gameState.players[playerId].life = value;
          } else if (field === 'name') {
            gameState.players[playerId].name = value;
          } else if (field === 'poison') {
            gameState.players[playerId].poison = value;
          } else if (field === 'commanderInfo') {
            gameState.players[playerId].commanderInfo = value;
          } else if (field === 'commanderDamage') {
            if (gameState.players[playerId].commanderDamage[subPlayerId] !== undefined) {
              gameState.players[playerId].commanderDamage[subPlayerId] = value;
            }
          }

          broadcast(JSON.stringify({
            type: 'update',
            playerId,
            field,
            value,
            subPlayerId
          }));
        }
      } 
      else if (data.type === 'reset') {
        // リセット時、先攻プレイヤーをランダムで再選出
        gameState = createInitialState(gameState.activePlayerCount);
        broadcast(JSON.stringify({
          type: 'init',
          state: gameState
        }));
        console.log(`ゲームがリセットされました。（参加人数: ${gameState.activePlayerCount}人, 先攻: Player ${gameState.firstPlayerId}）`);
      }
      else if (data.type === 'set_player_count') {
        const count = Math.max(2, Math.min(6, parseInt(data.count, 10) || 4));
        gameState = createInitialState(count);
        broadcast(JSON.stringify({
          type: 'init',
          state: gameState
        }));
        console.log(`プレイヤー人数が ${count} 人に変更されました。`);
      }
    } catch (err) {
      console.error('メッセージ処理エラー:', err);
    }
  });

  ws.on('close', () => {
    console.log('クライアントが切断しました。');
  });
});

function broadcast(messageStr) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

server.listen(port, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(` EDH Life Hub サーバーが起動しました。`);
  console.log(` URL: http://localhost:${port}`);
  console.log(`==================================================`);
});
