import * as forgerock from '@forgerock/javascript-sdk';

/*
 * @forgerock/javascript-sdk
 *
 * index.html
 *
 * Copyright (c) 2020 ForgeRock. All rights reserved.
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

const FATAL = 'Fatal';
forgerock.Config.set({
  clientId: 'aldarPoc', // e.g. 'ForgeRockSDKClient'
  redirectUri: `${window.location.origin}/callback`, // e.g. 'https://sdkapp.example.com:8443/callback'
  scope: 'openid profile email address phone', // e.g. 'openid profile email address phone'
  serverConfig: {
    baseUrl: 'https://openam-aldar-euw3-dev.id.forgerock.io/am', // e.g. 'https://myorg.forgeblocks.com/am' or 'https://openam.example.com:8443/openam'
    timeout: 60000, // 90000 or less
  },
  realmPath: 'alpha', // e.g. 'alpha' or 'root'
  oauthThreshold: 60,
  tree: 'Darna-Registration',
});

// Define custom handlers to render and submit each expected step
const handlers = {
  PhoneNumber: (step) => {
    const panel = document.querySelector('#PhoneNumber');
    panel.querySelector('.btn').addEventListener('click', () => {
      const phoneCallback = step.getCallbackOfType('NameCallback');
      console.log(phoneCallback);
      phoneCallback.setName(panel.querySelector('input[type=text]').value);
      nextStep(step);
    });
  },
  CustomerName: (step) => {
    const panel = document.querySelector('#CustomerName');
    panel.querySelector('.btn').addEventListener('click', () => {
      const cbs = step.getCallbacksOfType('StringAttributeInputCallback');
      console.log(panel.querySelector('#CustomerName-FirstName').value);
      cbs[0].setValue(panel.querySelector('#CustomerName-FirstName').value);
      cbs[1].setValue(panel.querySelector('#CustomerName-LastName').value);
      cbs[2].setValue(panel.querySelector('#CustomerName-EmailId').value);
      nextStep(step);
    });
  },
  CustomerInfo: (step) => {
    const panel = document.querySelector('#CustomerInfo');
    panel.querySelector('.btn').addEventListener('click', () => {
      const cbs = step.getCallbacksOfType('StringAttributeInputCallback');
      cbs[0].setValue(panel.querySelector('#CustomerInfo-birth').value);
      cbs[1].setValue(panel.querySelector('#CustomerInfo-gender').value);
      cbs[2].setValue(panel.querySelector('#CustomerInfo-nation').value);
      cbs[3].setValue(panel.querySelector('#CustomerInfo-city').value);
      nextStep(step);
    });
  },
  OTP: (step) => {
    const panel = document.querySelector('#OTP');
    panel.querySelector('.btn').addEventListener('click', () => {
      const otpCallback = step.getCallbackOfType('PasswordCallback');
      otpCallback.setPassword(panel.querySelector('input[type=text]').value);
      nextStep(step);
    });
  },
  Debug: (step) => {
    console.log('debug step');
    nextStep(step);
  },
  Error: (step) => {
    document.querySelector('#Error span').innerHTML = step.getCode();
  },
  [FATAL]: (step) => {},
};

// Show only the view for this handler
const showStep = (handler) => {
  if (handler === 'Debug') {
    return true;
  }
  document.querySelectorAll('#steps > div').forEach((x) => x.classList.remove('active'));
  const panel = document.getElementById(handler);
  if (!panel) {
    console.error(`No panel with ID "${handler}"" found`);
    return false;
  }
  console.log('make visible', handler);
  document.getElementById(handler).classList.add('active');
  return true;
};

const showUser = (user) => {
  document.querySelector('#User pre').innerHTML = JSON.stringify(user, null, 2);
  const panel = document.querySelector('#User');
  panel.querySelector('.btn').addEventListener('click', () => {
    logout();
  });
  showStep('User');
};

const getStage = (step) => {

  const nameCallbacks = step.getCallbacksOfType('NameCallback');
  const passwordCallbacks = step.getCallbacksOfType('PasswordCallback');
  const attributeCallbacks = step.getCallbacksOfType('StringAttributeInputCallback');

  if (nameCallbacks.length === 1) {
    return 'PhoneNumber';
  }

  if (attributeCallbacks.length === 3) {
    return 'CustomerName';
  }
  if (attributeCallbacks.length === 4) {
    return 'CustomerInfo';
  }

  if (passwordCallbacks.length === 1) {
    return 'OTP';
  }

  const toc = step.getCallbacksOfType('TextOutputCallback');
  if (toc.length) {
    return 'Debug';
  }

  return undefined;
};

// Display and bind the handler for this stage
const handleStep = async (step) => {
  console.log(step);
  switch (step.type) {
    case 'LoginSuccess': {
      // If we have a session token, get user information
      const sessionToken = step.getSessionToken();
      const tokens = await forgerock.TokenManager.getTokens();
      const user = await forgerock.UserManager.getCurrentUser();
      console.log('sessionToken', sessionToken);
      console.log('tokens', tokens);
      console.log('user', user);
      return showUser(user);
    }

    case 'LoginFailure': {
      showStep('Error');
      handlers['Error'](step);
      return;
    }

    default: {
      const stage = getStage(step) || FATAL;
      console.log('stage is', stage);
      if (!showStep(stage)) {
        showStep(FATAL);
        handlers[FATAL](step);
      } else {
        handlers[stage](step);
      }
    }
  }
};

const handleFatalError = (err) => {
  console.error('Fatal error', err);
  showStep(FATAL);
};

// Get the next step using the FRAuth API
const nextStep = (step) => {
  forgerock.FRAuth.next(step).then(handleStep).catch(handleFatalError);
};

const logout = async () => {
  try {
    await forgerock.FRUser.logout();
    location.reload(true);
  } catch (error) {
    console.error(error);
  }
};

// Begin the login flow
nextStep();

document.getElementById('Error').addEventListener('click', nextStep);
document.getElementById('start-over').addEventListener('click', nextStep);
document.getElementById('Fatal').addEventListener('click', nextStep);
