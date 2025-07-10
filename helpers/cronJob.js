import cron from 'node-cron';
import { getUpcomingEmiUsers } from '../models/cronjobModel.js';
import logger from './logger.js';
import { sendEmiReminder } from '../config/mailer.js';
// import { sendWhatsAppMessage } from '../config/whatsApp.js';
import moment from 'moment-timezone';

import dotenv from 'dotenv';
dotenv.config();

export const nextEmiDueReminderToStudents = () => {
    const cronExpression = process.env.EMI_REMINDER_CRON || '0 9 * * *'; // "* * * * *"
    cron.schedule(cronExpression, async () => {
        logger.info('⏰ Running EMI Reminder Cron Job...');
        try {
            const emis = await getUpcomingEmiUsers();
            if (emis.length === 0) {
                logger.info('ℹ️ No EMIs due in the next 7 days');
                return;
            }
            for (const emi of emis) {
                const formattedDate = moment(emi.due_date).tz('Asia/Kolkata').format('DD MMM YYYY');
                await sendEmiReminder(emi?.email, emi?.name, emi?.installment_amount, emi?.course_name, formattedDate);
                
                // const message = `Hi ${emi?.name}, your next EMI of ₹${emi?.installment_amount} for course name: ${emi?.course_name} is due on ${formattedDate}. Please pay on time to continue accessing the course.`;
                // await sendWhatsAppMessage(emi?.phone, message);
                logger.info(`✅ Email sent to ${emi.email} ${emi.id}`);
            }
        } catch (error) {
            return logger.info(`Error on nextEmiDueReminderToStudents : ${error}`);
            }
        });
};