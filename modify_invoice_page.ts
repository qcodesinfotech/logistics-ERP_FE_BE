import * as fs from 'fs';

const filePath = './client/src/pages/delivery-invoices.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const receivePaymentTarget = `{invoice.status === "approved" && (
            <Button variant="default" className="bg-green-600 hover:bg-green-700">
              <CreditCard className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
          )}`;

const receivePaymentReplacement = `{invoice.status === "approved" && (
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("paid")}>
              <CreditCard className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
          )}`;

if (content.includes(receivePaymentTarget)) {
    content = content.replace(receivePaymentTarget, receivePaymentReplacement);
} else {
    console.log("Could not find receive payment button target");
}

fs.writeFileSync(filePath, content);
console.log("Updated delivery-invoices.tsx");
