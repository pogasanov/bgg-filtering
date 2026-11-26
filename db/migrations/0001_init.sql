CREATE TABLE ranked_games (
  bgg_id integer PRIMARY KEY,
  rank integer NOT NULL,
  title text NOT NULL,
  year integer,
  geek_rating double precision,
  average_rating double precision,
  num_voters integer,
  imported_at timestamptz NOT NULL
);

CREATE INDEX idx_ranked_games_rank ON ranked_games(rank);

CREATE TABLE games (
  bgg_id integer PRIMARY KEY,
  rank integer,
  title text NOT NULL,
  year integer,
  geek_rating double precision,
  average_rating double precision,
  num_voters integer,
  min_players integer,
  max_players integer,
  playing_time integer,
  weight double precision,
  bgg_url text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX idx_games_rank ON games(rank);

CREATE TABLE game_tags (
  game_id integer NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('category', 'mechanic')),
  name text NOT NULL,
  PRIMARY KEY (game_id, kind, name)
);

CREATE INDEX idx_game_tags_name ON game_tags(name);

CREATE TABLE game_languages (
  game_id integer NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  name text NOT NULL,
  PRIMARY KEY (game_id, name)
);

CREATE INDEX idx_game_languages_name ON game_languages(name);

CREATE TABLE player_recommendations (
  game_id integer NOT NULL REFERENCES games(bgg_id) ON DELETE CASCADE,
  player_count text NOT NULL,
  best_votes integer NOT NULL,
  recommended_votes integer NOT NULL,
  not_recommended_votes integer NOT NULL,
  verdict text NOT NULL,
  PRIMARY KEY (game_id, player_count)
);

CREATE INDEX idx_player_recommendations_lookup ON player_recommendations(player_count, verdict);

CREATE TABLE sync_runs (
  id serial PRIMARY KEY,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'error')),
  fetched_count integer NOT NULL DEFAULT 0,
  failed_ids integer[] NOT NULL DEFAULT '{}',
  error_message text
);

CREATE TABLE sync_lock (
  id integer PRIMARY KEY CHECK (id = 1),
  sync_run_id integer NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL
);
