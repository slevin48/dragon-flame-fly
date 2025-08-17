import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import dragonImage from '@/assets/cyberpunk-dragon.png';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Obstacle extends GameObject {
  passed: boolean;
}

const GAME_CONFIG = {
  canvas: { width: 400, height: 600 },
  dragon: { width: 50, height: 40, jumpForce: -8, gravity: 0.5 },
  obstacle: { width: 60, height: 200, gap: 150, speed: 2 },
  ground: { height: 50 }
};

export const FlappyDragon = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('flappyDragonHighScore') || '0');
  });

  const gameDataRef = useRef({
    dragon: { x: 100, y: 300, velocity: 0 },
    obstacles: [] as Obstacle[],
    lastObstacleX: 0
  });

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Cyberpunk city background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.canvas.height);
    gradient.addColorStop(0, 'hsl(240, 10%, 8%)');
    gradient.addColorStop(0.7, 'hsl(260, 15%, 12%)');
    gradient.addColorStop(1, 'hsl(280, 20%, 8%)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    // City silhouette
    ctx.fillStyle = 'hsl(240, 20%, 5%)';
    const buildings = [50, 80, 120, 90, 150, 70, 100];
    buildings.forEach((height, i) => {
      const width = GAME_CONFIG.canvas.width / buildings.length;
      ctx.fillRect(i * width, GAME_CONFIG.canvas.height - height, width, height);
    });

    // Neon grid lines
    ctx.strokeStyle = 'hsl(200, 100%, 60%, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_CONFIG.canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, GAME_CONFIG.canvas.height);
      ctx.stroke();
    }
  }, []);

  const drawDragon = useCallback((ctx: CanvasRenderingContext2D, dragon: { x: number; y: number; velocity: number }) => {
    // Dragon glow effect
    ctx.shadowColor = 'hsl(280, 100%, 70%)';
    ctx.shadowBlur = 20;
    
    // Simple dragon shape (will be replaced with image when loaded)
    ctx.fillStyle = 'hsl(280, 100%, 70%)';
    ctx.fillRect(dragon.x, dragon.y, GAME_CONFIG.dragon.width, GAME_CONFIG.dragon.height);
    
    // Wing animation based on velocity
    const wingOffset = Math.sin(Date.now() * 0.01) * 5;
    ctx.fillStyle = 'hsl(320, 100%, 75%)';
    ctx.fillRect(dragon.x - 10, dragon.y + wingOffset, 15, 20);
    ctx.fillRect(dragon.x - 10, dragon.y + 15 + wingOffset, 15, 20);
    
    ctx.shadowBlur = 0;
  }, []);

  const drawObstacle = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle) => {
    // Cyberpunk pipe with neon glow
    ctx.shadowColor = 'hsl(200, 100%, 60%)';
    ctx.shadowBlur = 15;
    
    // Top pipe
    const gradient = ctx.createLinearGradient(obstacle.x, 0, obstacle.x + obstacle.width, 0);
    gradient.addColorStop(0, 'hsl(200, 100%, 60%)');
    gradient.addColorStop(0.5, 'hsl(180, 100%, 70%)');
    gradient.addColorStop(1, 'hsl(200, 100%, 60%)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(obstacle.x, 0, obstacle.width, obstacle.height);
    
    // Bottom pipe
    const bottomHeight = GAME_CONFIG.canvas.height - obstacle.height - GAME_CONFIG.obstacle.gap;
    ctx.fillRect(obstacle.x, GAME_CONFIG.canvas.height - bottomHeight, obstacle.width, bottomHeight);
    
    // Neon edges
    ctx.strokeStyle = 'hsl(180, 100%, 90%)';
    ctx.lineWidth = 2;
    ctx.strokeRect(obstacle.x, 0, obstacle.width, obstacle.height);
    ctx.strokeRect(obstacle.x, GAME_CONFIG.canvas.height - bottomHeight, obstacle.width, bottomHeight);
    
    ctx.shadowBlur = 0;
  }, []);

  const checkCollision = useCallback((dragon: GameObject, obstacle: Obstacle): boolean => {
    // Check collision with top pipe
    if (dragon.x < obstacle.x + obstacle.width &&
        dragon.x + dragon.width > obstacle.x &&
        dragon.y < obstacle.height) {
      return true;
    }
    
    // Check collision with bottom pipe
    const bottomPipeY = obstacle.height + GAME_CONFIG.obstacle.gap;
    if (dragon.x < obstacle.x + obstacle.width &&
        dragon.x + dragon.width > obstacle.x &&
        dragon.y + dragon.height > bottomPipeY) {
      return true;
    }
    
    return false;
  }, []);

  const updateGame = useCallback(() => {
    const gameData = gameDataRef.current;
    
    // Update dragon physics
    gameData.dragon.velocity += GAME_CONFIG.dragon.gravity;
    gameData.dragon.y += gameData.dragon.velocity;
    
    // Generate obstacles
    if (gameData.obstacles.length === 0 || 
        gameData.lastObstacleX > GAME_CONFIG.canvas.width / 2) {
      const height = Math.random() * 200 + 100;
      gameData.obstacles.push({
        x: GAME_CONFIG.canvas.width,
        y: 0,
        width: GAME_CONFIG.obstacle.width,
        height: height,
        passed: false
      });
      gameData.lastObstacleX = 0;
    }
    
    // Update obstacles
    gameData.obstacles = gameData.obstacles.filter(obstacle => {
      obstacle.x -= GAME_CONFIG.obstacle.speed;
      gameData.lastObstacleX += GAME_CONFIG.obstacle.speed;
      
      // Check if dragon passed obstacle
      if (!obstacle.passed && obstacle.x + obstacle.width < gameData.dragon.x) {
        obstacle.passed = true;
        setScore(prev => prev + 1);
      }
      
      // Check collision
      const dragonWithSize = {
        ...gameData.dragon,
        width: GAME_CONFIG.dragon.width,
        height: GAME_CONFIG.dragon.height
      };
      if (checkCollision(dragonWithSize, obstacle)) {
        setGameState('gameOver');
        return false;
      }
      
      return obstacle.x > -obstacle.width;
    });
    
    // Check ground/ceiling collision
    if (gameData.dragon.y > GAME_CONFIG.canvas.height - GAME_CONFIG.dragon.height ||
        gameData.dragon.y < 0) {
      setGameState('gameOver');
    }
  }, [checkCollision]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
    
    // Draw background
    drawBackground(ctx);
    
    // Draw obstacles
    gameDataRef.current.obstacles.forEach(obstacle => drawObstacle(ctx, obstacle));
    
    // Draw dragon
    drawDragon(ctx, gameDataRef.current.dragon);
    
    // Draw score
    ctx.font = 'bold 24px Orbitron, monospace';
    ctx.fillStyle = 'hsl(120, 100%, 60%)';
    ctx.shadowColor = 'hsl(120, 100%, 60%)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(score.toString(), GAME_CONFIG.canvas.width / 2, 50);
    ctx.shadowBlur = 0;
  }, [score, drawBackground, drawObstacle, drawDragon]);

  const gameLoop = useCallback(() => {
    if (gameState === 'playing') {
      updateGame();
      render();
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState, updateGame, render]);

  const jump = useCallback(() => {
    if (gameState === 'playing') {
      gameDataRef.current.dragon.velocity = GAME_CONFIG.dragon.jumpForce;
    }
  }, [gameState]);

  const startGame = useCallback(() => {
    gameDataRef.current = {
      dragon: { x: 100, y: 300, velocity: 0 },
      obstacles: [],
      lastObstacleX: 0
    };
    setScore(0);
    setGameState('playing');
  }, []);

  const resetGame = useCallback(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('flappyDragonHighScore', score.toString());
    }
    setGameState('menu');
  }, [score, highScore]);

  // Handle touch/click events
  useEffect(() => {
    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      jump();
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleInteraction);
      canvas.addEventListener('touchstart', handleInteraction);
      return () => {
        canvas.removeEventListener('click', handleInteraction);
        canvas.removeEventListener('touchstart', handleInteraction);
      };
    }
  }, [jump]);

  // Game loop effect
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.canvas.width}
          height={GAME_CONFIG.canvas.height}
          className="border-2 border-primary rounded-lg shadow-[var(--shadow-intense)] neon-glow"
          style={{ 
            maxWidth: '100vw', 
            height: 'auto',
            touchAction: 'none'
          }}
        />
        
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <h1 className="text-4xl font-bold mb-2 cyberpunk-text">
              CYBER DRAGON
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Tap to flap through the neon city
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              High Score: <span className="text-accent">{highScore}</span>
            </p>
            <Button 
              onClick={startGame}
              className="game-button px-8 py-3 text-lg font-bold rounded-lg"
            >
              START GAME
            </Button>
          </div>
        )}
        
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <h2 className="text-3xl font-bold mb-2 text-destructive">
              GAME OVER
            </h2>
            <p className="text-xl mb-2">
              Score: <span className="cyberpunk-text font-bold">{score}</span>
            </p>
            <p className="text-lg mb-6">
              Best: <span className="text-accent font-bold">{Math.max(score, highScore)}</span>
            </p>
            <Button 
              onClick={resetGame}
              className="game-button px-8 py-3 text-lg font-bold rounded-lg"
            >
              PLAY AGAIN
            </Button>
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm">
        Tap anywhere on the screen to make the dragon flap its wings and avoid the neon obstacles!
      </p>
    </div>
  );
};