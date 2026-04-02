# Admin Setup Guide

This guide will help you create and manage admin users for the Ride App platform.

## Creating Admin Users

There are two ways to create an admin user:

### Method 1: Quick Seed (Default Admin)

This method creates a default admin user with predefined credentials:

```bash
cd server
npm run seed:admin
```

**Default Admin Credentials:**

- Phone: `+8801700000000` (use `1700000000` in the app)
- Name: Admin User
- Email: admin@rideapp.com

### Method 2: Custom Admin (Interactive)

This method allows you to create a custom admin with your own details:

```bash
cd server
npm run create:admin
```

You'll be prompted to enter:

- Phone number (with country code, e.g., +8801712345678)
- Name
- Email

**Features:**

- Validates phone number format
- Checks if user already exists
- Can upgrade existing users to admin role
- Interactive and user-friendly

## Using the Admin Panel

1. **Launch the App**

   - Start the app and navigate to the role selection screen
   - Select "Admin"

2. **Login**

   - Enter your admin phone number (without country code)
   - For default admin: `1700000000`
   - For custom admin: use the number you created

3. **Admin Dashboard**
   - View platform statistics
   - Manage users (customers, riders, admins)
   - Track all rides
   - Monitor earnings and analytics

## Admin Features

### Dashboard

- Total users, rides, and revenue statistics
- Today's performance metrics
- Rides by vehicle type breakdown

### User Management

- View all users with filters (customers, riders, admins)
- Search users by name or phone
- View detailed user profiles
- Delete users
- Pagination for large datasets

### Rides Management

- View all rides with filters
- Filter by status (completed, cancelled, active)
- Filter by vehicle type (bike, auto, cab)
- Track ride details (customer, rider, fare, distance)

### Earnings & Analytics

- Platform revenue overview
- Today's earnings
- Top earning riders leaderboard
- Sort by earnings or total rides
- Individual rider statistics

## Troubleshooting

### Admin Already Exists

If you run the seed script and an admin already exists, it will show the existing admin's details.

### Upgrade Existing User

If you try to create an admin with a phone number that belongs to a customer or rider, the interactive script will offer to upgrade that user to admin.

### Phone Number Format

Phone numbers must:

- Start with `+880` (Bangladesh country code)
- Be exactly 14 characters long
- Example: `+8801712345678`

### Login Issues

- Make sure you enter the phone number WITHOUT the country code in the app
- Example: If your admin phone is `+8801700000000`, enter `1700000000`

## Security Notes

- Admin access is restricted and protected by authentication
- Only users with the "admin" role can access admin endpoints
- Keep admin credentials secure
- Regularly monitor admin access logs

## Database Management

All admin users are stored in the same `users` collection with `role: "admin"`.

To manually check admin users in MongoDB:

```javascript
db.users.find({ role: "admin" });
```

To manually create an admin in MongoDB:

```javascript
db.users.insertOne({
  phone: "+8801712345678",
  role: "admin",
  name: "Your Name",
  email: "your@email.com",
  balance: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

## Support

For issues or questions, please contact the development team.
