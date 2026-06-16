import axios from 'axios';
import 'dotenv/config';

async function test() {
  const baseUrl = process.env.ESSL_BASE_URL;
  const username = process.env.ESSL_USERNAME;
  const password = process.env.ESSL_PASSWORD;
  const deviceSerial = process.env.ESSL_DEVICE_SERIAL;

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>2026-06-01 00:01</FromDateTime>
      <ToDateTime>2026-06-29 23:59</ToDateTime>
      <SerialNumber>${deviceSerial}</SerialNumber>
      <UserName>${username}</UserName>
      <UserPassword>${password}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(baseUrl, soapEnvelope, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '"http://tempuri.org/GetTransactionsLog"' }
  });

  const strDataMatch = response.data.match(/<strDataList>([\s\S]*?)<\/strDataList>/);
  let strData = strDataMatch ? strDataMatch[1] : "";
  console.log("RAW strDataList:");
  console.log(JSON.stringify(strData)); // JSON stringify to see exact \t, \n, \r characters
  process.exit(0);
}

test();
