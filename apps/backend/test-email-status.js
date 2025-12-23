const axios = require('axios');

async function testEmailStatus() {
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
    
    // Test email verification status
    console.log('Checking email verification status...');
    const emailStatusResponse = await axios.get('http://localhost:4000/auth/email/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    
    console.log('Email status check successful!');
    console.log('Email status:', emailStatusResponse.data);
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

testEmailStatus();