import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as moment from "moment-timezone"; // Use moment-timezone for reliable server time

// Initialize Firebase Admin SDK (only once)
try {
  admin.initializeApp();
} catch (e) {
  console.log("Admin SDK already initialized or initialization failed.");
}

const db = admin.firestore();
const ALL_TEAMS = ["Andreea", "Cristina", "Scarlat"];

// --- Scheduled Function to Delete Old Appointments --- 

// Schedule: Run every Monday at 3:00 AM (adjust timezone and time as needed)
// Timezone based on IANA Time Zone Database names, e.g., "Europe/Bucharest"
// https://cloud.google.com/functions/docs/scheduling
// Use crontab guru to configure schedule: https://crontab.guru/
export const deleteOldAppointmentsScheduled = functions.pubsub
    .schedule("0 3 * * 1") // "At 03:00 on Monday."
    .timeZone("Europe/Bucharest")
    .onRun(async (context) => {
      console.log("Scheduled deletion of old appointments started.");

      // Calculate the cutoff date: Monday of the week *before* the previous week
      // Example: If today is Wed, Apr 16th, 2025
      // - Current week started Mon, Apr 14th
      // - Previous week started Mon, Apr 7th
      // - We want to delete everything *before* Apr 7th.
      const today = moment().tz("Europe/Bucharest");
      // Go to the start of the *current* week (Monday)
      const currentWeekStart = today.clone().startOf("isoWeek"); 
      // Go back one full week to get the start of the *previous* week
      const cutoffDate = currentWeekStart.subtract(1, "week"); 
      const cutoffDateString = cutoffDate.format("YYYY-MM-DD");

      console.log(`Cutoff date calculated: Deleting documents before ${cutoffDateString}`);

      const deletionPromises = [];
      let totalDeletedCount = 0;

      for (const teamName of ALL_TEAMS) {
        console.log(`Processing team: ${teamName}`);
        const teamAppointmentsRef = db.collection(`teams/${teamName}/appointments`);
        
        // Query for documents (days) with ID less than the cutoff date string
        const query = teamAppointmentsRef.where(
            admin.firestore.FieldPath.documentId(),
            "<",
            cutoffDateString
        );

        // Push the deletion process for this team into the promises array
        deletionPromises.push(
            query.get().then(async (snapshot) => {
              if (snapshot.empty) {
                console.log(`  No old documents found for team ${teamName}.`);
                return 0; // Return count for this team
              }

              // Use batch writes for efficiency
              const batch = db.batch();
              let teamDeletedCount = 0;
              snapshot.forEach((doc) => {
                console.log(`    - Scheduling deletion for doc: ${doc.id} (Team: ${teamName})`);
                batch.delete(doc.ref);
                teamDeletedCount++;
              });

              try {
                await batch.commit();
                console.log(`  Successfully deleted ${teamDeletedCount} old documents for team ${teamName}.`);
                return teamDeletedCount; // Return count for this team
              } catch (error) {
                console.error(`  Error committing batch delete for team ${teamName}:`, error);
                return 0; // Return 0 on error for this team
              }
            }).catch((error) => {
              console.error(`  Error querying old documents for team ${teamName}:`, error);
              return 0; // Return 0 on error for this team
            })
        );
      }

      // Wait for all team deletions to complete
      try {
        // Explicitly type the results array if possible, or use 'unknown[]' / 'any[]'
        const results: number[] = await Promise.all(deletionPromises);
        totalDeletedCount = results.reduce((sum, count) => sum + count, 0);
        console.log(`Scheduled deletion finished. Total documents deleted: ${totalDeletedCount}`);
        return null; // Indicate success
      } catch (error) {
        console.error("Error during execution of scheduled deletion promises:", error);
        return null; // Indicate completion even with errors in some promises
      }
    });

// Note: You might need to enable Pub/Sub and Cloud Scheduler APIs in your Google Cloud project
// if this is the first scheduled function.
// You also need to make sure the Firebase Admin SDK has permissions to delete documents.
// This usually works by default with the App Engine default service account. 