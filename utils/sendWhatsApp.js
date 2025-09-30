import axios from "axios";

const WHATSAPP_INSTANCE_ID = "68B962AACC4B0"; 
const WHATSAPP_ACCESS_TOKEN = "68822d48a7005"; 



const formatNumber = (number) => {
  // Remove any spaces ya + sign
  number = number.replace(/\D/g, "");

  // Agar sirf 10 digit hai (jaise 9167140832)
  if (number.length === 10) {
    return "91" + number;
  }

  // Agar already 12 digit with 91 hai (jaise 919167140832)
  if (number.length === 12 && number.startsWith("91")) {
    return number;
  }

  // Fallback: as is return
  return number;
};


export const sendWhatsAppMessage = async (number, message) => {
  try {
    const payload = {
      number: formatNumber(number), // formatted number
      type: "text",
      message,
      instance_id: WHATSAPP_INSTANCE_ID,
      access_token: WHATSAPP_ACCESS_TOKEN,
    };

    const res = await axios.post("https://app.simplywhatsapp.com/api/send", payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("✅ WhatsApp message sent:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error?.response?.data || error.message);
    return null;
  }
};
