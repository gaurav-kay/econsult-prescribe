// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

let express = require("express");
let app = express();
let ejs = require("ejs");
let pdf = require("html-pdf");
let path = require("path");
const nodemailer = require("nodemailer");
const cors = require('cors')({ origin: true })
app.use(cors)
app.use(express.json());


var Airtable = require('airtable');
var base = new Airtable({ apiKey: '' }).base('appK8jtKwcTOdR3Os');


let footer = "<p style=\"color:#777777; text-align:center; font-size:7pt\">\
Disclaimer: This prescription is based on the information provided by you in an online consultation and not on any physical verification. \
Visit a doctor in case of emergency. This prescription is valid in India only. \
<p>"

async function sendMail(stream, details) {
    // TODO: Set up SMTP server

    const FROM_EMAIL = ""
    const SMTP_USER = ""
    const SMTP_PASSWORD = ""
    const SMTP_PROVIDER = ""

    let transporter = nodemailer.createTransport({
        host: SMTP_PROVIDER,
        port: 465,
        secure: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASSWORD
        }
    });

    var toEmails = ["indiaeconsult.db@gmail.com", details.doctor.emailid]
    if (details.patient.emailid) {
        toEmails.push(details.patient.emailid)
    }

    let info = await transporter.sendMail({
        from: `"eConsult by COVID19INDIA.org" <${FROM_EMAIL}>`,
        to: toEmails.join(","),
        subject: `Your Prescription - ${details.prescription.id}`,
        text: `The attached file contains your prescription by ${details.doctor.name} on ${details.prescription.issued_on}`,
        html: `The attached file contains your prescription by <b>${details.doctor.name}</b> on ${details.prescription.issued_on}`,
        attachments: [
            {
                filename: `Prescription_${details.prescription.id}.pdf`,
                content: stream
            }
        ]
    });

    console.log(info)
}

app.post("/generateReport", (req, res) => {
    var details = req.body;
    ejs.renderFile(path.join(__dirname, './views/', "prescription-template.ejs"), { details: details }, (err, data) => {
        if (err) {
            return res.send(err);
        } else {
            var file_name = "prescription-" + details.prescription.id + ".pdf";
            let options = {
                "height": "11.25in",
                "width": "8.5in",
                "header": {
                    "height": "10mm",
                },
                "footer": {
                    "height": "25mm",
                    "contents": footer
                },
            };
            pdf.create(data, options).toStream(async function (err, stream) {
                if (err) {
                    res.json({
                        message: 'Sorry, we were unable to generate pdf',
                    });
                }

                await sendMail(stream, details);

                res.setHeader('Content-type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=' + file_name);
                return stream.pipe(res); // your response
            });
        }
    });
})

app.get("/getDoctorDetails", (req, res) => {
    var emailid = req.query.emailid;
    base('Doctors').select({
        view: 'Verified_Doctors',
        maxRecords: 1,
        filterByFormula: "{Email}='" + emailid + "'"
    }).firstPage(function (err, records) {
        if (err || records.length == 0) {
            return res.status(400).send({ message: 'Could not find a matching record.' });
        }
        else {
            res.setHeader('Content-type', 'application/json');
            return res.send(records[0]._rawJson);
        }
    });
})



const api = functions.https.onRequest(app);

module.exports = { api }

