DROP DATABASE IF EXISTS appdb;

CREATE DATABASE IF NOT EXISTS appdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE appdb;

SOURCE database/schema.sql;
