-- If DB_NAME in .env is not innopapp, replace innopapp below.
CREATE DATABASE IF NOT EXISTS innopapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE innopapp;

SOURCE schema.sql;
