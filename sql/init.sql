CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    description TEXT
);

INSERT INTO users (name, description) VALUES 
('User1', 'Description for user 1'),
('User2', 'Description for user 2');
