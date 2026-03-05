CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    photo VARCHAR(255),
    datasheet VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Default admin (password: admin123)
INSERT INTO admins (username, password) VALUES ('admin', '$2y$10$swSDo2y4MqoHKbLrF6smMuHBrBiLhc.oMMjjmvVnaoRJF5Hz3X/KO');

-- Sample Categories
INSERT INTO categories (name) VALUES ('Cable Tools'), ('Pipe Tools'), ('But Welding Machine'), ('Accessories'), ('Test & Measurement');
