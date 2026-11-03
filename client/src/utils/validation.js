// Client-side checks mirror the server rules for instant feedback; the server is always authoritative.
export const isEmail = (v) => /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(String(v || '').trim());
export const isIndianMobile = (v) => /^(?:\+?91|0)?[6-9]\d{9}$/.test(String(v || '').replace(/[\s\-().]/g, ''));
export const isPincode = (v) => /^[1-9]\d{5}$/.test(String(v || '').replace(/\s/g, ''));
export const passwordProblem = (v) => {
  if (!v || v.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/i.test(v)) return 'Include at least one letter.';
  if (!/\d/.test(v)) return 'Include at least one number.';
  return null;
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
