import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function deleteAllExceptSettings() {
  try {
    // Get ALL table names from the database
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations';
    `;
    
    const allTables = await prisma.$queryRawUnsafe(tablesQuery);
    
    console.log('Found tables:', allTables.map(t => t.table_name));
    console.log('\nStarting deletion process...\n');
    
    // Delete from all tables EXCEPT 'settings'
    for (const table of allTables) {
      const tableName = table.table_name;
      
      if (tableName === 'settings') {
        console.log(`⏭️  Skipping: ${tableName} (keeping this table)`);
        continue;
      }
      
      // Delete all data from this table
      await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}";`);
      console.log(`✓ Deleted all data from: ${tableName}`);
    }
    
    console.log('\n✅ Done! All tables cleared except settings');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllExceptSettings();
