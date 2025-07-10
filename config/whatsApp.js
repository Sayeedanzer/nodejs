import fetch from 'node-fetch';

const API_KEY = 'SGHFulM6BbPMh7mXZk7nThhWnADbhcMIyy';

export const sendWhatsAppMessage = async (to, message) => {
  const response = await fetch('https://api.360messenger.com/v2/sendMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: new URLSearchParams({
      phonenumber: to, // E.164 format
      text: message,
    //   url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Example',
    //   delay: '01-12-2025 09:29' // optional GMT time
    })
  });

  const data = await response.json();
  // console.log(data);
};
