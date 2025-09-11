import * as utils from '../utils.js';

const getPrivateKeyFromPasscode = async (key, passcode) => {
  return utils.getPrivateKeyFromPasscode("password", passcode, { password: key });
};

const encrypt = async (key, data) => {
  return utils.encrypt(key, data);
};

const decrypt = async (key, cipher) => {
  return utils.decrypt(key, cipher);
};

window.getPrivateKeyFromPasscode = getPrivateKeyFromPasscode;
window.encrypt = encrypt;
window.decrypt = decrypt;