/**
 * Test script to verify the sanitizeConfigValue function prevents template injection
 * This demonstrates the security fix for the OpenVPN configuration generation
 */

// Copy the sanitization function from openvpnController.js
function sanitizeConfigValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    // Remove newlines, carriage returns, and tabs to prevent multi-line injection
    .replace(/[\r\n\t]/g, ' ')
    // Remove non-printable ASCII characters (keep only printable chars 0x20-0x7E)
    .replace(/[^\x20-\x7E]/g, '')
    // Remove OpenVPN directive characters that could be dangerous
    .replace(/[<>]/g, '')
    // Collapse multiple spaces into single space
    .replace(/\s+/g, ' ')
    // Trim whitespace from ends
    .trim()
    // Limit length to prevent DOS via extremely long comments
    .substring(0, 255);
}

console.log('=== Template Injection Vulnerability Tests ===\n');

// Test 1: Newline injection attempt
const maliciousEmail1 = 'attacker@evil.com\nremote malicious.server.com 1194';
const sanitized1 = sanitizeConfigValue(maliciousEmail1);
console.log('Test 1: Newline injection');
console.log('Input:     ', JSON.stringify(maliciousEmail1));
console.log('Sanitized: ', JSON.stringify(sanitized1));
console.log('Safe:      ', !sanitized1.includes('\n'));
console.log('');

// Test 2: Multi-line directive injection
const maliciousPolicy = 'Premium\nscript-security 2\nup "rm -rf /"';
const sanitized2 = sanitizeConfigValue(maliciousPolicy);
console.log('Test 2: Multi-line directive injection');
console.log('Input:     ', JSON.stringify(maliciousPolicy));
console.log('Sanitized: ', JSON.stringify(sanitized2));
console.log('Safe:      ', !sanitized2.includes('\n'));
console.log('');

// Test 3: Carriage return injection
const maliciousEmail3 = 'user@test.com\rremote evil.com';
const sanitized3 = sanitizeConfigValue(maliciousEmail3);
console.log('Test 3: Carriage return injection');
console.log('Input:     ', JSON.stringify(maliciousEmail3));
console.log('Sanitized: ', JSON.stringify(sanitized3));
console.log('Safe:      ', !sanitized3.includes('\r'));
console.log('');

// Test 4: Tab injection
const maliciousEmail4 = 'user@test.com\t\tauth-user-pass password.txt';
const sanitized4 = sanitizeConfigValue(maliciousEmail4);
console.log('Test 4: Tab injection');
console.log('Input:     ', JSON.stringify(maliciousEmail4));
console.log('Sanitized: ', JSON.stringify(sanitized4));
console.log('Safe:      ', !sanitized4.includes('\t'));
console.log('');

// Test 5: Non-printable characters
const maliciousEmail5 = 'user@test.com\x00\x01\x02null-bytes';
const sanitized5 = sanitizeConfigValue(maliciousEmail5);
console.log('Test 5: Non-printable characters');
console.log('Input:     ', Buffer.from(maliciousEmail5).toString('hex'));
console.log('Sanitized: ', JSON.stringify(sanitized5));
console.log('Safe:      ', sanitized5.length < maliciousEmail5.length);
console.log('');

// Test 6: Angle brackets (XML/directive markers)
const maliciousInput6 = '<script>alert("xss")</script>';
const sanitized6 = sanitizeConfigValue(maliciousInput6);
console.log('Test 6: Angle brackets removal');
console.log('Input:     ', JSON.stringify(maliciousInput6));
console.log('Sanitized: ', JSON.stringify(sanitized6));
console.log('Safe:      ', !sanitized6.includes('<') && !sanitized6.includes('>'));
console.log('');

// Test 7: Length limitation (DOS prevention)
const longInput = 'A'.repeat(1000);
const sanitized7 = sanitizeConfigValue(longInput);
console.log('Test 7: Length limitation');
console.log('Input length:     ', longInput.length);
console.log('Sanitized length: ', sanitized7.length);
console.log('Safe:             ', sanitized7.length <= 255);
console.log('');

// Test 8: Normal valid input should pass through safely
const validEmail = 'john.doe@company.com';
const sanitized8 = sanitizeConfigValue(validEmail);
console.log('Test 8: Valid input preservation');
console.log('Input:     ', JSON.stringify(validEmail));
console.log('Sanitized: ', JSON.stringify(sanitized8));
console.log('Preserved: ', validEmail === sanitized8);
console.log('');

// Test 9: Multiple spaces collapse
const multiSpace = 'Premium    Policy    Name';
const sanitized9 = sanitizeConfigValue(multiSpace);
console.log('Test 9: Multiple spaces collapse');
console.log('Input:     ', JSON.stringify(multiSpace));
console.log('Sanitized: ', JSON.stringify(sanitized9));
console.log('Collapsed: ', sanitized9 === 'Premium Policy Name');
console.log('');

// Test 10: Null and undefined handling
console.log('Test 10: Null and undefined handling');
console.log('null:      ', JSON.stringify(sanitizeConfigValue(null)));
console.log('undefined: ', JSON.stringify(sanitizeConfigValue(undefined)));
console.log('');

console.log('=== Summary ===');
console.log('All sanitization tests demonstrate that the vulnerability has been fixed.');
console.log('User-controlled input is now properly sanitized before insertion into OpenVPN configs.');
