/**
 * Test script for Device.getAllDevices method
 * Tests the fix for "Incorrect arguments to mysqld_stmt_execute" error
 */

const Device = require('./src/models/Device');

async function testGetAllDevices() {
    console.log('Testing Device.getAllDevices with different parameters...\n');

    try {
        // Test 1: Default parameters
        console.log('Test 1: Default parameters (page=1, limit=10)');
        const result1 = await Device.getAllDevices(1, 10);
        console.log('✓ Success:', {
            totalDevices: result1.data.length,
            pagination: result1.pagination
        });
        console.log();

        // Test 2: Different page and limit
        console.log('Test 2: Custom parameters (page=2, limit=5)');
        const result2 = await Device.getAllDevices(2, 5);
        console.log('✓ Success:', {
            totalDevices: result2.data.length,
            pagination: result2.pagination
        });
        console.log();

        // Test 3: String parameters (should be converted to integers)
        console.log('Test 3: String parameters (page="1", limit="20")');
        const result3 = await Device.getAllDevices("1", "20");
        console.log('✓ Success:', {
            totalDevices: result3.data.length,
            pagination: result3.pagination
        });
        console.log();

        // Test 4: Edge case - large page number
        console.log('Test 4: Large page number (page=100, limit=10)');
        const result4 = await Device.getAllDevices(100, 10);
        console.log('✓ Success:', {
            totalDevices: result4.data.length,
            pagination: result4.pagination
        });
        console.log();

        console.log('All tests passed! ✓');
        process.exit(0);
    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testGetAllDevices();
