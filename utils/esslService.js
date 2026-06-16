import axios from 'axios';
import 'dotenv/config';

/**
 * Adds an employee/student to the eSSL biometric device using the SOAP API.
 * 
 * @param {Object} data
 * @param {string} data.studentId - e.g. STU-001
 * @param {string} data.firstName
 * @param {string} data.lastName
 * @returns {Promise<Object>} Response object
 */
export const addEmployeeToBiometric = async (data) => {
  const baseUrl = process.env.ESSL_BASE_URL;
  const apiKey = process.env.ESSL_API_KEY;
  const username = process.env.ESSL_USERNAME;
  const password = process.env.ESSL_PASSWORD;
  const deviceSerial = process.env.ESSL_DEVICE_SERIAL;

  // Check if eSSL is configured
  if (!baseUrl || !apiKey || !deviceSerial) {
    console.warn("eSSL Biometric API is not configured. Skipping biometric registration.");
    return { success: false, message: "eSSL configuration missing" };
  }

  const { studentId, staffId, wardenId, employeeCode, firstName, lastName } = data;
  const finalCode = employeeCode || studentId || staffId || wardenId;
  const employeeName = `${firstName || ''} ${lastName || ''}`.trim();
  const commandId = Math.floor(Math.random() * 1000000); // Generate a random CommandId

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AddEmployee xmlns="http://tempuri.org/">
      <APIKey>${apiKey}</APIKey>
      <EmployeeCode>${finalCode}</EmployeeCode>
      <EmployeeName>${employeeName}</EmployeeName>
      <CardNumber>0</CardNumber>
      <SerialNumber>${deviceSerial}</SerialNumber>
      <UserName>${username || ''}</UserName>
      <UserPassword>${password || ''}</UserPassword>
      <CommandId>${commandId}</CommandId>
    </AddEmployee>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await axios.post(baseUrl, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/AddEmployee"'
      },
      timeout: 10000 // 10 seconds timeout
    });

    console.log(`eSSL Biometric Registration Request sent for ${finalCode}. CommandId: ${commandId}`);
    return { success: true, data: response.data, commandId };
  } catch (error) {
    console.error(`eSSL Biometric Registration failed for ${finalCode}:`, error.message);
    if (error.response) {
      console.error("eSSL Response Data:", error.response.data);
    }
    return { success: false, error: error.message };
  }
};

/**
 * Fetches attendance transaction logs from the eSSL biometric device.
 * 
 * @param {string} fromDate - Format YYYY-MM-DD
 * @param {string} toDate - Format YYYY-MM-DD
 * @returns {Promise<Object>} Response object containing parsed logs
 */
export const syncAttendanceLogs = async (fromDate, toDate) => {
  const baseUrl = process.env.ESSL_BASE_URL;
  const username = process.env.ESSL_USERNAME;
  const password = process.env.ESSL_PASSWORD;
  const deviceSerial = process.env.ESSL_DEVICE_SERIAL;

  if (!baseUrl || !deviceSerial) {
    console.warn("eSSL Biometric API is not configured. Skipping attendance sync.");
    return { success: false, message: "eSSL configuration missing", logs: [] };
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>${fromDate} 00:00</FromDateTime>
      <ToDateTime>${toDate} 23:59</ToDateTime>
      <SerialNumber>${deviceSerial}</SerialNumber>
      <UserName>${username || ''}</UserName>
      <UserPassword>${password || ''}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await axios.post(baseUrl, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/GetTransactionsLog"'
      },
      timeout: 15000 // 15 seconds timeout
    });

    // Extract strDataList from XML response
    // Basic regex since XML parsing libraries might not be installed
    const strDataMatch = response.data.match(/<strDataList>([\s\S]*?)<\/strDataList>/);
    let strData = strDataMatch ? strDataMatch[1] : "";
    
    // Parse the delimited string (Assuming CSV or Tab-delimited: EmployeeCode, Timestamp, Direction)
    // Often it's EmployeeCode\tDate Time\tDeviceID\tVerifyMode\tInOutMode
    const parsedLogs = [];
    if (strData) {
      const lines = strData.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Split by comma or tab
        const parts = trimmed.split(/[,\t]/);
        if (parts.length >= 2) {
            // Assume format: EmployeeCode, Timestamp, Direction (or InOutMode where 0=In, 1=Out)
            const employeeCode = parts[0].trim();
            const timestamp = parts[1].trim(); // Usually "YYYY-MM-DD HH:mm:ss"
            let direction = "IN";
            let verificationType = "Biometric";
            
            if (parts.length >= 5) {
                // Assuming typical standard eSSL format:
                // EmployeeCode \t Timestamp \t DeviceID \t VerifyMode \t InOutMode
                const inOutMode = parts[4].trim();
                direction = (inOutMode === "1" || inOutMode.toLowerCase() === "out") ? "OUT" : "IN";
            } else if (parts.length >= 3) {
                const dirField = parts[2].trim().toLowerCase();
                if (dirField === "out" || dirField === "1") direction = "OUT";
            }
            
            parsedLogs.push({
                employeeCode,
                timestamp: new Date(timestamp),
                direction,
                verificationType,
                deviceName: "Biometric Device",
                serialNumber: deviceSerial
            });
        }
      }
    }

    console.log(`eSSL Attendance Sync successful. Fetched ${parsedLogs.length} logs.`);
    return { success: true, logs: parsedLogs };
  } catch (error) {
    console.error("eSSL Attendance Sync failed:", error.message);
    return { success: false, error: error.message, logs: [] };
  }
};
