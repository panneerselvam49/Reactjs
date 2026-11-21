import nodeMail from 'nodemailer';


const transporter = nodeMail.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});
export default transporter;
