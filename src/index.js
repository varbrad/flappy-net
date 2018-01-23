const WIDTH = 1000;
const HEIGHT = 600;

const MAX_PLAYERS = 200;
const BEST_POOL = 20;

const PLAYER_X = 80;
const GRAVITY = 0.25;
const JUMP_PULSE = -7;
const MAX_SPEED = 9;

const WALL_GAP = 150; // Gap for birds to go thru
const WALL_SPACING = 400; // How far between each wall
const WALL_SIZE = 64; // How wide the wall is
const WALL_SPEED = -4; // How fast the walls move
const WALL_COUNT = 4; // How many walls to spawn

const canvas = document.getElementById('canvas');
const gc = canvas.getContext('2d');

canvas.width = WIDTH;
canvas.height = HEIGHT;

let players = [];
let walls = [];
let loop = true;
let score = 0;
let generation = 0;

let lastBest = null;
let bestEver = null;

function update() {
  // If all players are dead, restart!
  if (players.filter(p => p.alive).length === 0) {
    score = 0;
    makeWalls();
    newGeneration();
  }
  score++;
  // Move walls
  walls.forEach(w => {
    w.x += WALL_SPEED;
  });
  if (walls.length > 1 && walls[0].x < -WALL_SIZE * 0.5) {
    let w = walls.shift();
    w.x = walls[walls.length - 1].x + WALL_SPACING;
    walls.push(w);
  }

  // Get the upcoming wall for the players
  const nextWall = walls[0].x > PLAYER_X ? walls[0] : walls[1];
  // Update players
  players.forEach(p => {
    // Do nothing if the agent is dead
    if (!p.alive) return;

    p.dy += GRAVITY;
    if (p.dy > MAX_SPEED) p.dy = MAX_SPEED;
    p.y += p.dy;

    if (p.y < 0 || p.y > HEIGHT || collide(p)) {
      p.fitness = score - Math.abs(p.y - nextWall.y);
      p.alive = false;
    }

    // Activate the brain!
    let normalX = (nextWall.x - p.x) / WIDTH;
    let normalY = (nextWall.y - p.y + HEIGHT) / (HEIGHT * 2);
    let result = p.brain.activate([normalX, normalY]);
    if (result > 0.5) p.dy = JUMP_PULSE;
  });
  // Draw stuff
  draw();
  // Update loop
  if (loop) requestAnimationFrame(update);
}

function collide(p) {
  for (let i = 0; i < 2; ++i) {
    let wall = walls[i];
    if (
      p.x - p.r > wall.x + WALL_SIZE * 0.5 ||
      wall.x - WALL_SIZE * 0.5 > p.x + p.r
    )
      return false;
    if (p.y - p.r < wall.y - WALL_GAP * 0.5) return true;
    if (p.y + p.r > wall.y + WALL_GAP * 0.5) return true;
    return false;
  }
}

function draw() {
  // Clear buffer
  gc.clearRect(0, 0, WIDTH, HEIGHT);

  // Draw players
  gc.lineWidth = 3;
  players.forEach(p => {
    if (!p.alive) return;
    gc.strokeStyle = 'hsl(' + p.hue + ', 50%, 50%)';
    gc.fillStyle = 'hsl(' + p.hue + ', 50%, 25%)';
    gc.beginPath();
    gc.arc(p.x, p.y, p.r, 0, 6.28);
    gc.closePath();
    gc.fill();
    gc.stroke();
  });

  // Draw walls
  walls.forEach(w => {
    gc.save();
    gc.translate(w.x, w.y);
    gc.strokeStyle = 'hotpink';
    gc.fillStyle = '#223';
    // top wall part
    gc.beginPath();
    gc.rect(-WALL_SIZE * 0.5, -HEIGHT - WALL_GAP * 0.5, WALL_SIZE, HEIGHT);
    gc.rect(-WALL_SIZE * 0.5, WALL_GAP * 0.5, WALL_SIZE, HEIGHT);
    gc.closePath();
    gc.fill();
    gc.stroke();
    // wall 'cross'
    gc.beginPath();
    gc.moveTo(-4, -4);
    gc.lineTo(4, 4);
    gc.moveTo(-4, 4);
    gc.lineTo(4, -4);
    gc.closePath();
    gc.stroke();
    // Restore the gc matrix
    gc.restore();
  });

  // Draw text
  gc.fillStyle = 'white';
  gc.font = '12px sans-serif';
  gc.textBaseline = 'top';
  gc.fillText('Alive: ' + players.filter(p => p.alive).length, 10, 10);
  gc.fillText('Score: ' + score, 10, 30);
  if (bestEver)
    gc.fillText('Best Ever: ' + bestEver.fitness.toFixed(1), 10, 50);
  if (lastBest)
    gc.fillText(
      'Gen ' + generation + ' Best: ' + lastBest.fitness.toFixed(1),
      10,
      70
    );
}

function initialGeneration() {
  players = [];
  for (let i = 0; i < MAX_PLAYERS; ++i) {
    players.push(newPlayer());
  }
}

function newPlayer(brain) {
  const p = {
    x: PLAYER_X,
    y: Math.random() * HEIGHT / 2 + HEIGHT / 4,
    dy: 0,
    ddy: 0,
    r: 8,
    hue: Math.round(Math.random() * 360),
    alive: true,
    brain: brain || randomBrain(),
    fitness: 0
  };

  return p;
}

function randomBrain() {
  let b = new synaptic.Architect.Perceptron(2, 5, 1).toJSON();
  b.connections.forEach(con => (con.weight = Math.random() - 0.5));
  b.neurons.forEach(ner => (ner.bias = Math.random() - 0.5));
  return synaptic.Network.fromJSON(b);
}

function newGeneration() {
  generation++;
  if (players.length === 0) return initialGeneration();
  // Get best from this generation
  let best = players
    .slice()
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, BEST_POOL);
  lastBest = best[0];
  if (!bestEver || bestEver.fitness < best[0].fitness) bestEver = best[0];
  players = [];
  best.forEach(p => {
    players.push(newPlayer(bestEver.brain));
    players.push(newPlayer(p.brain));
    players.push(newPlayer(mutate(p.brain)));
    players.push(newPlayer(crossover(best[0].brain, p.brain)));
    players.push(newPlayer(crossover(best[1].brain, p.brain)));
  });

  while (players.length < MAX_PLAYERS) players.push(newPlayer());

  // loop = false;
}

function mutate(brain) {
  brain = brain.toJSON();

  for (let i = 0; i < brain.neurons.length; ++i) {
    if (Math.random() < 0.2) {
      brain.neurons[i].bias *= (Math.random() - 0.5) * 3;
    }
  }

  return synaptic.Network.fromJSON(brain);
}

function crossover(brainA, brainB) {
  brainA = brainA.toJSON();
  brainB = brainB.toJSON();

  for (let i = 0; i < brainA.neurons.length; ++i) {
    if (Math.random() < 0.2) {
      let t = brainB.neurons[i].bias;
      brainB.neurons[i].bias = brainA.neurons[i].bias;
      brainA.neurons[i].bias = t;
    }
  }

  return synaptic.Network.fromJSON(Math.random() > 0.5 ? brainA : brainB);
}

function makeWalls() {
  walls = [];
  for (let i = 0; i < WALL_COUNT; ++i) {
    walls.push({
      x: WIDTH * 0.75 + i * WALL_SPACING,
      y: Math.random() * (HEIGHT * 0.7) + HEIGHT * 0.15,
      gap: WALL_GAP
    });
  }
}

// Key listeners
function keypress(e) {
  if (e.repeat) return;
  if (e.key === ' ') players.forEach(p => (p.y = -100));
  if (e.key === 'p') console.log(bestEver.brain.toJSON());
}

update();

window.addEventListener('keypress', keypress);
