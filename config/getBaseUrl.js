export const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};