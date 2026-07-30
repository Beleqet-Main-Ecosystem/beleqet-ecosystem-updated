/**
 * @fileoverview Amharic ('am') translation dictionary matrix for automated emails.
 */

export const amDictionary = {
  WELCOME: {
    subject: 'እንኳን ወደ በልቀት በደህና መጡ፣ {name}!',
    body: 'ሰላም {name}፣ እንኳን ወደ በልቀት ስነ-ምህዳር በደህና መጡ። ዛሬውኑ እድሎችን ያስሱ!',
  },
  PASSWORD_RESET: {
    subject: 'የበልቀት የይለፍ ቃልዎን ይቀይሩ',
    body: 'ሰላም {name}፣ የይለፍ ቃልዎን ለመቀየር እባክዎ እዚህ ይጫኑ፡ {resetUrl}',
  },
  PAYMENT_RECEIPT: {
    subject: 'የበልቀት የክፍያ ደረሰኝ - {txId}',
    body: 'ሰላም {name}፣ የ {formattedAmount} ክፍያዎን ተቀብለናል። ደረሰኝ፡ {txId}። እናመሰግናለን!',
  },
  NEWSLETTER: {
    subject: 'የበልቀት ወርሃዊ ዜና',
    body: 'ሰላም {name}፣ {newsletterContent} | የደንበኝነት ምዝገባዎን ለመሰረዝ እዚህ ይጫኑ፡ {unsubscribeUrl}',
  },
};
