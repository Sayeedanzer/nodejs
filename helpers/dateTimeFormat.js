import moment from 'moment-timezone';

Date.prototype.toJSON = function () {
  return moment(this).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
};


export const getISTDateTime = () => {
  return moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
};
