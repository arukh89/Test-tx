const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create players table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        fid VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255),
        display_name VARCHAR(255),
        pfp_url TEXT,
        bio TEXT,
        total_score INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create game_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        player_fid VARCHAR(255) REFERENCES players(fid),
        block_height INTEGER,
        prediction INTEGER,
        actual_transactions INTEGER,
        points_earned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_players_fid ON players(fid);
      CREATE INDEX IF NOT EXISTS idx_players_total_score ON players(total_score DESC);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_player_fid ON game_sessions(player_fid);
    `);

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Player database operations
class PlayerDatabase {
  async getPlayer(fid) {
    try {
      const result = await pool.query(
        'SELECT * FROM players WHERE fid = $1',
        [fid]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting player:", error);
      return null;
    }
  }

  async createOrUpdatePlayer(playerData) {
    try {
      const { fid, username, displayName, pfpUrl, bio } = playerData;
      
      const result = await pool.query(`
        INSERT INTO players (fid, username, display_name, pfp_url, bio, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (fid) 
        DO UPDATE SET 
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          pfp_url = EXCLUDED.pfp_url,
          bio = EXCLUDED.bio,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [fid, username, displayName, pfpUrl, bio]);
      
      return result.rows[0];
    } catch (error) {
      console.error("Error creating/updating player:", error);
      throw error;
    }
  }

  async getLeaderboard(limit = 10) {
    try {
      const result = await pool.query(`
        SELECT 
          fid,
          username,
          display_name,
          total_score,
          games_played,
          correct_predictions,
          CASE 
            WHEN games_played > 0 THEN ROUND((correct_predictions::float / games_played * 100)::numeric, 1)
            ELSE 0 
          END as accuracy_percentage
        FROM players 
        WHERE games_played > 0
        ORDER BY total_score DESC, accuracy_percentage DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      return [];
    }
  }

  async recordPrediction(fid, blockHeight, prediction) {
    try {
      const result = await pool.query(`
        INSERT INTO game_sessions (player_fid, block_height, prediction)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [fid, blockHeight, prediction]);
      
      return result.rows[0];
    } catch (error) {
      console.error("Error recording prediction:", error);
      throw error;
    }
  }

  async updatePredictionResult(fid, blockHeight, actualTransactions) {
    try {
      // Calculate points based on prediction accuracy
      const predictionResult = await pool.query(`
        SELECT * FROM game_sessions 
        WHERE player_fid = $1 AND block_height = $2
        ORDER BY created_at DESC LIMIT 1
      `, [fid, blockHeight]);

      if (predictionResult.rows.length === 0) {
        return null;
      }

      const session = predictionResult.rows[0];
      const prediction = session.prediction;
      const difference = Math.abs(prediction - actualTransactions);
      
      // Scoring system: 
      // Perfect prediction: 100 points
      // Within 10: 75 points
      // Within 25: 50 points  
      // Within 50: 25 points
      // Within 100: 10 points
      // Else: 0 points
      let points = 0;
      if (difference === 0) points = 100;
      else if (difference <= 10) points = 75;
      else if (difference <= 25) points = 50;
      else if (difference <= 50) points = 25;
      else if (difference <= 100) points = 10;

      // Update game session with results
      await pool.query(`
        UPDATE game_sessions 
        SET actual_transactions = $1, points_earned = $2
        WHERE id = $3
      `, [actualTransactions, points, session.id]);

      // Update player stats
      await pool.query(`
        UPDATE players 
        SET 
          total_score = total_score + $1,
          games_played = games_played + 1,
          correct_predictions = correct_predictions + CASE WHEN $2 = 0 THEN 1 ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE fid = $3
      `, [points, difference, fid]);

      return { points, difference, actualTransactions };
    } catch (error) {
      console.error("Error updating prediction result:", error);
      throw error;
    }
  }

  async getPlayerStats(fid) {
    try {
      const result = await pool.query(`
        SELECT 
          p.*,
          COUNT(gs.id) as total_predictions,
          AVG(gs.points_earned) as avg_points,
          MAX(gs.points_earned) as best_score
        FROM players p
        LEFT JOIN game_sessions gs ON p.fid = gs.player_fid
        WHERE p.fid = $1
        GROUP BY p.id
      `, [fid]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error getting player stats:", error);
      return null;
    }
  }
}

module.exports = {
  pool,
  initializeDatabase,
  PlayerDatabase
};