# Birthday Notification System

A robust, scalable Node.js application designed to send birthday notifications to users at exactly 9 AM in their local timezone. Built with **NestJS**, **MongoDB**, **Redis**, and **BullMQ**.


## 🚀 Key Features

*   **Timezone Aware**: Schedules notifications based on the user's local time (e.g., 9 AM in Sydney vs. 9 AM in New York).
*   **Scalability**:
    *   **Batches**: Processes multiple timezones in batches (`processInBatches`) to handle high loads.
    *   **Distributed Caching**: Uses **Redis** to cache timezone data, reducing database load.
    *   **Distributed Locking**: Uses **Redis** locks to ensure only one worker processes a job at a time.
    *   **Bulk Operations**: Utilizes MongoDB `bulkWrite` for high-performance batch creation of event logs.
*   **Reliability**:
    *   **Idempotency**: Guarantees strict unique execution via MongoDB Unique Compound Indexes (`userId` + `eventType` + `year`).
    *   **Recovery & Backfill**: Includes automatic retry for failed jobs and a **Manual Backfill API** to recover missed events after downtime.
    *   **Testing Mode**: Includes a built-in `TestWebhookController` with sequential failure simulation to verify retry logic. Or using link https://eowypdtgjxh1eib.m.pipedream.net


## 🛠 Tech Stack

*   **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
*   **Database**: [MongoDB](https://www.mongodb.com/) (Data storage)
*   **Queue**: [Bull](https://github.com/OptimalBits/bull) (Job processing)
*   **Cache**: [Redis](https://redis.io/) (Timezone caching & Distributed locks)
*   **Testing**: [Jest](https://jestjs.io/) (Unit tests)

## 🔄 System Flow

1.  **User Management**:
    *   Users are created via API.
    *   When a user is added/updated, the Redis Timezone Cache is invalidated.

2.  **Scheduler (Hourly)**:
    *   Fetches distinct timezones from Redis (or DB if cache miss).
    *   Filters timezones where the current local time is **9:00 AM**.
    *   Triggers `BirthdayProcessor` for matching timezones.

3.  **Event Processing**:
    *   `BirthdayProcessor` finds users with birthdays matching today (in their timezone).
    *   `EventService` creates `NotificationLog` records using `bulkWrite` with `upsert` (Idempotency check).
    *   Jobs are pushed to the `notification` Bull Queue.

4.  **Notification Worker**:
    *   `NotificationProcessor` picks up jobs.
    *   Acquires a **Redis Lock** for the specific event.
    *   Checks status.
    *   Sends webhook request (defaulting to the internal Test Webhook).
    *   Updates status to `SENT` or `FAILED`.

## 🏁 Getting Started

### Prerequisites

*   Docker & Docker Compose
*   Node.js (v18+) & NPM (for local testing)

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd birthday-notification
    ```

2.  Install dependencies (optional, for local dev):
    ```bash
    make install
    ```

3.  Setup Environment Variables:
    ```bash
    cp .env.example .env
    ```

### Running the Application

Start the entire stack (App + MongoDB + Redis) using Docker:

```bash
make up
```

*   **API**: `http://localhost:3000`
*   **Swagger Docs**: `http://localhost:3000/api`
*   **Bull Dashboard**: `http://localhost:3000/admin/queues`
*   **Test Webhook**: `http://localhost:3000/test-webhook`


To stop the services:
```bash
make down
```

### Seeding Data

To populate the database with 1000 fake users:

**Important:** If running from host machine (outside Docker), verify `MONGODB_URI` points to `localhost:27018`.

```bash
export MONGODB_URI=mongodb://localhost:27018/birthday_notification
make seed
```



## 🧪 Testing

The project maintains high test coverage (>85%) for core business logic.

```bash
# Run Unit Tests
make test

# Run Tests with Coverage Report
make test-cov
```

## 🔌 API Reference

### User Management
*   `POST /user`: Create a user.
*   `DELETE /user/:id`: Delete a user.
*   `PUT /user/:id`: Update user details.

### Scheduler & Recovery
*   `POST /scheduler/trigger-backfill`: **Recovery API**. Scans all timezones that have passed 9 AM today and processes any missed events. Useful after server downtime.
*   `POST /scheduler/trigger-events`: Manually trigger the hourly check (for testing).

### Test Webhook
*   `POST /test-webhook`: Simulates a webhook receiver.
    *   Fails every 3rd request by default to test retry logic.

##  Handling Server Downtime

**Scenario:** The server crashes at 8:00 AM and restarts at 2:00 PM. Users in timezones where 9:00 AM occurred during the downtime (e.g., 10 AM, 11 AM) would normally be missed.

**Solution:**
1.  **Backfill Mechanism:** The system has a backfill logic that checks `isPastCheckHour`.
2.  **Action:** Upon restart, an administrator triggers the recovery endpoint:
    ```bash
    curl -X POST http://localhost:3000/scheduler/trigger-backfill
    ```
3.  **Result:** The system identifies all timezones where the current time is **past 9 AM**, checks for missing logs, and processes them safely.

[![Demo Video](https://img.youtube.com/vi/xMW5LlsnzNM/0.jpg)](https://www.youtube.com/watch?v=xMW5LlsnzNM)

---
Author: [Your Name]
