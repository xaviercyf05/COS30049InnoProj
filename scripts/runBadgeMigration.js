const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'cos30049fr',
  database: 'digital_park_guide',
};

async function runMigration() {
  let connection;
  try {
    console.log('🔄 Connecting to MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected successfully\n');

    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'database', 'migration_badge_validity_linkedmodule.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.startsWith('SELECT')) {
        console.log(`🔍 Executing query ${i + 1}/${statements.length}...`);
        const [rows] = await connection.execute(statement);
        console.log('   Result:', JSON.stringify(rows, null, 2));
      } else {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
        await connection.execute(statement);
        console.log(`   ✅ Done`);
      }
    }

    console.log('\n✨ Migration completed successfully!');
    
    // Verify the columns were added
    console.log('\n📋 Verifying Badges table structure...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'Badges' AND TABLE_SCHEMA = 'digital_park_guide'
       ORDER BY ORDINAL_POSITION`
    );
    
    console.log('\nBadges table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
