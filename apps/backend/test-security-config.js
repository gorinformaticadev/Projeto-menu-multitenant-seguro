const axios = require('axios');

async function testSecurityConfig() {
  try {
    // First login to get a token
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@system.com',
      password: 'admin123'
    }, {
      timeout: 5000
    });
    
    const token = loginResponse.data.accessToken;
    console.log('Login successful!');
    
    // Test security config
    console.log('Checking security configuration...');
    const securityConfigResponse = await axios.get('http://localhost:4000/security-config/full', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    
    console.log('Security config check successful!');
    console.log('Security config:', securityConfigResponse.data);
  } catch (error) {
    console.log('Error occurred:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error message:', error.message);
    }
  }
}

testSecurityConfig();