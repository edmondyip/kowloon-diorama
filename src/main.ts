import './ui/styles.css';
import { createKowloonGame } from './core/game';

const container = document.getElementById('canvas-container');
if (!container) {
  throw new Error('Missing #canvas-container element');
}

const game = createKowloonGame(container);
game.start();
