# Personal Finance Tracker

A modern, web-based personal finance tracking application built with React, Vite, and Firebase. This app helps users manage their income and expenses, track account balances, and generate financial reports directly from Google Sheets.

## 🚀 Features

- **User Authentication**: Secure Google login with Firebase Authentication
- **Transaction Management**: Add, edit, and delete income and expense transactions
- **Multi-Account Support**: Track multiple bank accounts and spending categories
- **Real-time Dashboard**: Visual statistics and balance tracking
- **Google Sheets Integration**: Automatic report generation and syncing
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Data Persistence**: All data stored securely in Firestore

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Functions), Node.js/Express
- **State Management**: React Context API with useReducer
- **Google Integration**: Google Drive API, Google Sheets API
- **Routing**: React Router DOM

## 📋 Key Functionality

### Transaction Tracking
- Add income and expense transactions with detailed information
- Link transactions to specific accounts
- Track check numbers and transaction dates
- Real-time balance calculation

### Account Management
- Create and manage multiple accounts (checking, savings, credit cards)
- Account type and number validation
- Account selection for transactions

### Reporting
- Automatic financial reports via Google Sheets integration
- Real-time data syncing between app and spreadsheet
- Customizable report templates

### Data Management
- Real-time data synchronization with Firestore
- Local state management with reducers
- Loading states and error handling

## 🎯 Installation

1. Clone the repository:
git clone [repository-url]
cd [project-name]

2. Install frontend dependencies:
npm install

3. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication (Google sign-in)
   - Enable Firestore Database
   - Configure Firebase SDK credentials

4. Set up server files:
   - Create `server/.env.local` with your environment variables
   - Create `server/service-account-key.json` with your Google Service Account key
   - Install server dependencies: npm install

5. Start the development server:
npm run dev

## 🔧 Usage

1. **Authentication**: Sign in with Google account
2. **Add Accounts**: Create your bank accounts and credit cards
3. **Record Transactions**: Add income and expenses with details
4. **View Reports**: Generate financial reports in Google Sheets

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── context/             # Authentication and global state management
├── firebase/            # Firebase configuration and services
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and libraries
├── pages/               # Main application pages
├── reducer/             # State management reducers
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── App.tsx              # Main application component

server/
├── googleAuth.js        # Google API authentication and utility functions
├── googleDriveProxy.js  # Express routes for Google Drive integration
└── service-account-key.json # Google Service Account credentials
```

## 📊 Dashboard Overview

The dashboard displays:
- Total income and expenses
- Current balance
- Recent transactions
- Account summaries
- Quick transaction entry form

## 🔄 Google Sheets Integration

- Automatic report generation using Google Sheets API
- Real-time data sync between application and spreadsheet
- Customizable report templates
- Secure authentication flow with OAuth2

## 🛡️ Security

- Firebase Authentication with Google login
- Secure data storage in Firestore
- Token management and refresh mechanisms
- Role-based access control
- Server-side Google API proxy for secure integration

## 📱 Responsive Design

- Mobile-first approach
- Adapts to all screen sizes
- Touch-friendly interface
- Optimized performance

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## 📄 License

[MIT License](LICENSE)

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

*Built with React, TypeScript, Firebase, and Node.js for modern, secure personal finance management*
