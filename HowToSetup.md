# Enterprise POS Installation & Setup Guide (HowToSetup.md)

This comprehensive guide covers installing, configuring, running, and customizing the **Enterprise Retail Point of Sale (POS) & ERP Solution**.

---

## 1. Prerequisites & System Requirements

- **Operating System:** Ubuntu 22.04+ / Debian 12+ / Alpine Linux 3.19+ / Windows Server 2022+ / macOS
- **Node.js:** v22.0.0 or higher (LTS recommended)
- **Package Manager:** npm v10+ or yarn v1.22+
- **Hardware:**
  - Minimum: 1 vCPU, 1 GB RAM, 10 GB Disk
  - Recommended: 2 vCPU, 2 GB RAM, 25 GB SSD

---

## 2. Deployment Target 1: Linux VPS (Ubuntu / Debian)

Follow these steps to deploy on a clean Linux Virtual Private Server (VPS) with PM2 process manager and Nginx reverse proxy:

### Step 2.1: Install Node.js v22
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 repository & runtime
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx

# Verify installation
node -v   # Output: v22.x.x
npm -v    # Output: 10.x.x
```

### Step 2.2: Clone Repository & Install Dependencies
```bash
# Clone the repository to /var/www/pos
sudo git clone https://github.com/mdshofiuddin/pos.git /var/www/pos
cd /var/www/pos

# Set ownership
sudo chown -R $USER:$USER /var/www/pos

# Install dependencies (root, backend, and frontend)
npm install
```

### Step 2.3: Configure Production Environment Variables
Before running `npm start`, ensure `JWT_SECRET` is set in your environment or written to `.env`:
```bash
# Option A: Export directly to environment before starting
export JWT_SECRET=$(openssl rand -hex 32)

# Verify: echo $JWT_SECRET | wc -c should output 65 (32 hex chars + newline)
echo $JWT_SECRET | wc -c

# Option B: Write to .env file
echo "JWT_SECRET=$(openssl rand -hex 32)" > apps/api/.env
cat << EOF >> apps/api/.env
NODE_ENV=production
PORT=5000
SHOP_NAME=Apex Mart Superstore
SHOP_ADDRESS=Plot 42, Block C, Gulshan-1, Dhaka-1212
SHOP_PHONE=+880 1712-998877
SHOP_VAT_NO=BIN-003847291-01
RECEIPT_FOOTER=Thank you for shopping with us! No refunds without receipt.
CURRENCY_CODE=BDT
CURRENCY_SYMBOL=৳
DEFAULT_TAX_RATE=5.0
EOF
```

### Step 2.4: Build Production Assets
Canonical build outputs:
Running `npm run build` compiles the React frontend into `apps/web/dist` and the Express backend into `apps/api/dist`. The API expects frontend distribution files at `apps/web/dist` for unified SPA serving.
```bash
# Compiles React Vite SPA to apps/web/dist and TypeScript Express API to apps/api/dist
npm run build
```

### Step 2.5: Database Initialization Order
The database initialization follows a strict, sequential two-stage order:
```bash
# 3a. Initialize schema: npm run db:migrate (creates tables, foreign keys, and indexes)
npm run db:migrate

# 3b. Seed baseline data: npm run seed (seeds admin roles, permissions, baseline products)
npm run seed
```
*(Note: Render free tier has ephemeral storage. SQLite database resets on restart. Use PostgreSQL adapter for production Render deployments).*

### Step 2.6: Run as a System Daemon using PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the unified POS production server
pm2 start apps/api/dist/server.js --name "pos-enterprise" --env production

# Ensure PM2 restarts automatically across system reboots
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

### Step 2.6: Configure Nginx Reverse Proxy
```bash
sudo cat << 'EOF' > /etc/nginx/sites-available/pos
server {
    listen 80;
    server_name pos.yourdomain.com; # Replace with your domain or IP

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site and reload Nginx
sudo ln -s /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3. Deployment Target 2: Docker & Docker Compose

Deploy the entire full-stack application inside an isolated Docker container with a single command:

### Step 3.1: Install Docker & Docker Compose
```bash
# Ubuntu Docker Installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Step 3.2: Clone & Launch via Docker Compose
```bash
git clone https://github.com/mdshofiuddin/pos.git
cd pos

# Launch container in detached mode
docker compose up -d --build
```

### Step 3.3: Verify Container Health
```bash
# Inspect container status
docker ps

# Check logs
docker compose logs -f pos-enterprise

# Access application
# Open browser at: http://localhost:5000
```

---

## 4. Database Setup & Migrations

The database system is fully automated:

### Method A: Automated Zero-Touch (Default)
When the application server boots (`npm start` or Docker container launch), the auto-bootstrapper:
1. Automatically executes [database/schema.sql](database/schema.sql) if tables do not exist.
2. Automatically seeds default retail products, categories, branches, and admin accounts if the database is empty.
3. No manual SQL command execution is required.

### Method B: Manual Database Reset / Seeding (CLI)
To manually reset or re-seed the database at any time:
```bash
# Re-run migrations and seeds via Node script:
npm run seed

# OR manually apply using SQLite CLI:
sqlite3 apps/api/pos_data.db < database/schema.sql
sqlite3 apps/api/pos_data.db < database/seed.sql
```

---

## 5. First Admin Login & Quick Walkthrough

Once the server is running, navigate to the web URL (e.g. `http://localhost:5000` or your VPS domain):

### Step 5.1: Login with Default Credentials
| Role | Username | Password | Purpose |
|---|---|---|---|
| **System Administrator** | `admin` | `Admin@123456` | Full platform administration & settings |
| **Store Manager** | `manager` | `Manager@123456` | Shift audits, price overrides, inventory |
| **Cashier** | `cashier` | `Cashier@123456` | Front-line POS billing & drawer sessions |
| **Inventory Officer** | `inventory` | `Inventory@123456` | Purchase receipts & supplier management |

### Step 5.2: Open Cashier Shift
1. Log in as `cashier` or `admin`.
2. Click **Cash Sessions** on the left navigation bar.
3. Enter your starting drawer float amount (e.g. `5000.00 BDT`).
4. Click **Open Shift Session**. Your POS Terminal is now unlocked and ready to bill!

### Step 5.3: Process Your First Sale
1. Click **POS Terminal** (`F9` fresh ticket).
2. Scan an item barcode using a hardware scanner (or click any product card on the grid).
3. Press `F4` (or click **Checkout**).
4. Choose **Cash** or **Split Payment** (Cash, Card, bKash, Nagad, Due).
5. Enter the amount received and click **Complete Sale**.
6. The compact thermal receipt modal will appear ready for **58mm / 80mm printing** (`Ctrl + P`).

---

## 6. Branding & Store Customization

You can change all store branding details in two ways:

### Option 1: In-App Store Settings UI (No Restart Required)
1. Log in as an **Admin** user.
2. Click **Store Settings** on the navigation menu.
3. Update the following fields directly:
   - **Shop Name:** e.g. `Fakir Fashion Superstore`
   - **Shop Address:** e.g. `Plot 12, Road 4, Sector 3, Uttara, Dhaka`
   - **Phone Number:** e.g. `+880 1700-000000`
   - **Tax / VAT Registration (BIN):** e.g. `BIN-123456789-01`
   - **Currency Code & Symbol:** `BDT` / `৳` or `USD` / `$`
   - **Default VAT Rate:** e.g. `5.0%`
   - **Receipt Paper Width:** `58mm` or `80mm`
   - **Thermal Receipt Footer Message:** e.g. `Thank you for shopping with us! Please come again.`
4. Click **Save Settings**. Changes take effect on all receipts immediately!

### Option 2: Environment Variables / `appsettings.json`
Update your `.env` or system environment variables:
- `SHOP_NAME`: Business display name
- `SHOP_ADDRESS`: Physical address for invoice headers
- `SHOP_PHONE`: Customer support contact
- `SHOP_VAT_NO`: Legal tax number
- `CURRENCY_CODE`: ISO currency code (e.g. `BDT`, `USD`)
- `CURRENCY_SYMBOL`: Currency symbol (e.g. `৳`, `$`)
- `RECEIPT_FOOTER`: Footer note printed on thermal receipts
- `DEFAULT_TAX_RATE`: Default VAT percentage

---

## 7. Production Verification & Health Check

Verify your deployment status at any time via the automated health endpoint:

```bash
curl -i http://localhost:5000/api/v1/health
```

**Expected JSON Response:**
```json
{
  "status": "HEALTHY",
  "uptime": 124.5,
  "timestamp": "2026-10-22T10:00:00.000Z",
  "database": {
    "status": "ok",
    "dialect": "sqlite",
    "latencyMs": 0.4
  },
  "environment": "production"
}
```
