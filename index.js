require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');

// Load configuration
const API_URL = 'https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql';

// Load refresh tokens
const refreshTokens = fs
  .readFileSync('token.txt', 'utf-8')  // Read file as a string
  .split('\n')                         // Split by newline
  .map(token => token.trim().replace('\r', '')) // Remove extra spaces and \r
  .filter(token => token.length > 0);  // Remove empty lines

console.log(refreshTokens);

// Axios headers
const headers = {
  Accept: '*/*',
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
};

// Function to refresh the access token
async function refreshAccessToken(refreshToken) {
  const apiKey = 'AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY';
  try {
    const response = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to refresh access token:', error.message);
    throw error;
  }
}

// API interaction function
async function apiRequest(url, method, payload) {
  try {
    const response = await axios({
      method,
      url,
      headers,
      data: payload,
    });
    return response.data;
  } catch (error) {
    console.error('API request failed:', error.message);
    throw error;
  }
}

// Grow and garden actions for each refresh token
async function handleGrowAndGarden(refreshToken, index) {
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    headers.authorization = `Bearer ${accessToken}`;

    console.log(`Processing Refresh Token ${index + 1}`);

    const infoQuery = {
      query: `query getCurrentUser {
        currentUser { id totalPoint depositCount }
        getGardenForCurrentUser {
          gardenStatus { growActionCount gardenRewardActionCount }
        }
      }`,
    };

    const info = await apiRequest(API_URL, 'POST', infoQuery);
    const { totalPoint: balance, depositCount: deposit } = info.data.currentUser;
    const {
      growActionCount: grow,
      gardenRewardActionCount: garden,
    } = info.data.getGardenForCurrentUser.gardenStatus;

    console.log(`Points: ${balance}, Deposit: ${deposit}, Grow: ${grow}, Garden: ${garden}`);

    // Grow action
    if (grow > 0) {
      const growActionQuery = {
        query: `mutation executeGrowAction {
          executeGrowAction(withAll: true) { totalValue multiplyRate }
          executeSnsShare(actionType: GROW, snsType: X) { bonus }
        }`,
      };

      const result = await apiRequest(API_URL, 'POST', growActionQuery);
      const reward = result.data.executeGrowAction.totalValue;
      console.log(`Rewards: ${reward}, New Balance: ${balance + reward}`);
    }

    // Garden action
    while (garden >= 10) {
      const gardenActionQuery = {
        query: `mutation executeGardenRewardAction($limit: Int!) {
          executeGardenRewardAction(limit: $limit) {
            data { cardId group }
            isNew
          }
        }`,
        variables: { limit: 10 },
      };

      const gardenResult = await apiRequest(API_URL, 'POST', gardenActionQuery);
      const cardIds = gardenResult.data.executeGardenRewardAction.data.map(
        (item) => item.cardId
      );
      console.log(`Opened Garden: ${cardIds}`);
    }
  } catch (error) {
    console.error(`Failed to process Refresh Token ${index + 1}:`, error.message);
  }
}

// Main workflow
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for (let i = 0; i < refreshTokens.length; i++) {
    const token = refreshTokens[i];
    await handleGrowAndGarden(token, i);
  }
  console.log('Completed processing all tokens. Cooling down for 40 minutes...');
  setTimeout(main, 40 * 60 * 1000); // Re-run after 30 min
  rl.close();

}

main();
