export const students = [
  { id: '1', name: 'Aarav Sharma', rollNumber: '001', class: '10-A', section: 'A', gender: 'Male', dob: '2009-03-15', parentName: 'Rajesh Sharma', parentPhone: '9876543210', parentEmail: 'rajesh@email.com', address: '12 MG Road, Delhi', feeStatus: 'paid' as const, attendancePercent: 94, photo: '' },
  { id: '2', name: 'Priya Patel', rollNumber: '002', class: '10-A', section: 'A', gender: 'Female', dob: '2009-07-22', parentName: 'Suresh Patel', parentPhone: '9876543211', parentEmail: 'suresh@email.com', address: '45 Park Street, Mumbai', feeStatus: 'unpaid' as const, attendancePercent: 87, photo: '' },
  { id: '3', name: 'Rohan Gupta', rollNumber: '003', class: '10-B', section: 'B', gender: 'Male', dob: '2009-01-10', parentName: 'Anil Gupta', parentPhone: '9876543212', parentEmail: 'anil@email.com', address: '78 Lake Road, Kolkata', feeStatus: 'paid' as const, attendancePercent: 91, photo: '' },
  { id: '4', name: 'Sneha Reddy', rollNumber: '004', class: '9-A', section: 'A', gender: 'Female', dob: '2010-05-18', parentName: 'Venkat Reddy', parentPhone: '9876543213', parentEmail: 'venkat@email.com', address: '23 Jubilee Hills, Hyderabad', feeStatus: 'unpaid' as const, attendancePercent: 78, photo: '' },
  { id: '5', name: 'Arjun Singh', rollNumber: '005', class: '9-A', section: 'A', gender: 'Male', dob: '2010-11-02', parentName: 'Harpreet Singh', parentPhone: '9876543214', parentEmail: 'harpreet@email.com', address: '56 Sector 17, Chandigarh', feeStatus: 'paid' as const, attendancePercent: 96, photo: '' },
  { id: '6', name: 'Kavya Nair', rollNumber: '006', class: '9-B', section: 'B', gender: 'Female', dob: '2010-09-25', parentName: 'Manoj Nair', parentPhone: '9876543215', parentEmail: 'manoj@email.com', address: '89 Marine Drive, Kochi', feeStatus: 'overdue' as const, attendancePercent: 82, photo: '' },
  { id: '7', name: 'Vikram Joshi', rollNumber: '007', class: '8-A', section: 'A', gender: 'Male', dob: '2011-04-14', parentName: 'Deepak Joshi', parentPhone: '9876543216', parentEmail: 'deepak@email.com', address: '34 Civil Lines, Jaipur', feeStatus: 'paid' as const, attendancePercent: 89, photo: '' },
  { id: '8', name: 'Ananya Das', rollNumber: '008', class: '8-A', section: 'A', gender: 'Female', dob: '2011-12-30', parentName: 'Amit Das', parentPhone: '9876543217', parentEmail: 'amit@email.com', address: '67 Salt Lake, Kolkata', feeStatus: 'unpaid' as const, attendancePercent: 73, photo: '' },
  { id: '9', name: 'Ishaan Mehta', rollNumber: '009', class: '10-A', section: 'A', gender: 'Male', dob: '2009-08-07', parentName: 'Prakash Mehta', parentPhone: '9876543218', parentEmail: 'prakash@email.com', address: '90 Navrangpura, Ahmedabad', feeStatus: 'paid' as const, attendancePercent: 92, photo: '' },
  { id: '10', name: 'Diya Iyer', rollNumber: '010', class: '10-B', section: 'B', gender: 'Female', dob: '2009-02-19', parentName: 'Srinivas Iyer', parentPhone: '9876543219', parentEmail: 'srinivas@email.com', address: '12 T Nagar, Chennai', feeStatus: 'paid' as const, attendancePercent: 97, photo: '' },
];

export const feeData = [
  { month: 'Oct', collected: 245000, pending: 55000 },
  { month: 'Nov', collected: 268000, pending: 42000 },
  { month: 'Dec', collected: 231000, pending: 69000 },
  { month: 'Jan', collected: 289000, pending: 31000 },
  { month: 'Feb', collected: 256000, pending: 44000 },
  { month: 'Mar', collected: 298000, pending: 22000 },
];

export const recentActivity = [
  { id: 1, action: 'Fee collected from Aarav Sharma', time: '10 min ago', type: 'fee' },
  { id: 2, action: 'Attendance marked for Class 10-A', time: '25 min ago', type: 'attendance' },
  { id: 3, action: 'New student Riya Kapoor added', time: '1 hr ago', type: 'student' },
  { id: 4, action: 'Marks entered for Class 9-A Math', time: '2 hrs ago', type: 'marks' },
  { id: 5, action: 'Parent alert sent to Class 8-A', time: '3 hrs ago', type: 'alert' },
  { id: 6, action: 'Fee reminder sent to 12 parents', time: '5 hrs ago', type: 'fee' },
];

export const marksData = [
  { subject: 'Mathematics', maxMarks: 100, obtained: 87, grade: 'A' },
  { subject: 'Science', maxMarks: 100, obtained: 92, grade: 'A+' },
  { subject: 'English', maxMarks: 100, obtained: 78, grade: 'B+' },
  { subject: 'Hindi', maxMarks: 100, obtained: 85, grade: 'A' },
  { subject: 'Social Studies', maxMarks: 100, obtained: 71, grade: 'B' },
  { subject: 'Computer Science', maxMarks: 100, obtained: 95, grade: 'A+' },
];

export const performanceTrend = [
  { exam: 'Unit Test 1', percentage: 72 },
  { exam: 'Mid Term', percentage: 78 },
  { exam: 'Unit Test 2', percentage: 82 },
  { exam: 'Unit Test 3', percentage: 85 },
  { exam: 'Final', percentage: 88 },
];

export const feeHistory = [
  { date: '2024-03-15', amount: 15000, receipt: 'REC-2024-0342', mode: 'UPI', balance: 0 },
  { date: '2024-01-10', amount: 15000, receipt: 'REC-2024-0198', mode: 'Cash', balance: 15000 },
  { date: '2023-11-05', amount: 15000, receipt: 'REC-2023-0891', mode: 'Bank Transfer', balance: 30000 },
  { date: '2023-09-01', amount: 15000, receipt: 'REC-2023-0654', mode: 'Cheque', balance: 45000 },
];

export const timeline = [
  { date: '2024-03-15', action: 'Fee of ₹15,000 collected via UPI', type: 'fee' },
  { date: '2024-03-10', action: 'Marked present for all days this week', type: 'attendance' },
  { date: '2024-03-05', action: 'Final exam marks entered: 88%', type: 'marks' },
  { date: '2024-02-28', action: 'Parent meeting scheduled', type: 'general' },
  { date: '2024-02-20', action: 'Fee reminder sent to parent', type: 'alert' },
  { date: '2024-02-15', action: 'Attendance below 80% alert triggered', type: 'alert' },
];

export const sentAlerts = [
  { id: 1, date: '2024-03-15', type: 'Fee Reminder', recipients: 45, message: 'Reminder: School fee for Q4 is due by March 31st...', via: 'SMS' },
  { id: 2, date: '2024-03-10', type: 'Attendance Alert', recipients: 12, message: 'Your ward has been absent for 3 consecutive days...', via: 'Email' },
  { id: 3, date: '2024-03-05', type: 'Exam Notice', recipients: 180, message: 'Final exams will begin from April 1st. Schedule attached...', via: 'Both' },
  { id: 4, date: '2024-02-28', type: 'General Notice', recipients: 200, message: 'School will remain closed on March 8th for Holi...', via: 'SMS' },
];

export const uploadHistory = [
  { id: 1, date: '2024-03-10', filename: 'students_batch_2024.xlsx', count: 45, status: 'success' },
  { id: 2, date: '2024-02-15', filename: 'new_admissions.csv', count: 23, status: 'success' },
  { id: 3, date: '2024-01-20', filename: 'transfer_students.xlsx', count: 8, status: 'partial' },
];

export const classes = ['8-A', '8-B', '9-A', '9-B', '10-A', '10-B'];
export const subjects = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science'];
export const examTypes = ['Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Mid Term', 'Final'];
