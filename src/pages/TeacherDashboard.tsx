import { Link } from 'react-router-dom';
import { Clock, ClipboardCheck, PenLine, MessageCircle, Megaphone } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

const schedule = [
  { time: '8:00 AM', class: '10-A', subject: 'Mathematics' },
  { time: '9:00 AM', class: '9-B', subject: 'Mathematics' },
  { time: '10:30 AM', class: '8-A', subject: 'Mathematics' },
  { time: '11:30 AM', class: '10-B', subject: 'Mathematics' },
  { time: '1:00 PM', class: '9-A', subject: 'Mathematics' },
];

const announcements = [
  { title: 'Staff meeting on Friday at 3 PM', date: 'Mar 15' },
  { title: 'Submit final exam papers by March 20', date: 'Mar 12' },
  { title: 'Annual day preparation begins next week', date: 'Mar 10' },
];

const queries = [
  { student: 'Aarav Sharma', class: '10-A', query: 'Need help with integration chapter', time: '2 hrs ago' },
  { student: 'Priya Patel', class: '10-A', query: 'Missed class, need notes for probability', time: '5 hrs ago' },
];

const TeacherDashboard = () => (
  <DashboardLayout role="teacher" title="Teacher Dashboard">
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <div className="card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Today's Schedule
          </h3>
          <div className="space-y-2">
            {schedule.map((s, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-primary w-20">{s.time}</span>
                <span className="text-sm font-medium text-foreground">{s.class}</span>
                <span className="text-sm text-muted-foreground">{s.subject}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Link to="/attendance" className="btn-quick-action justify-center py-5">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Mark Attendance</span>
          </Link>
          <Link to="/marks-entry" className="btn-quick-action justify-center py-5">
            <PenLine className="w-5 h-5 text-primary" />
            <span className="font-medium text-foreground">Enter Marks</span>
          </Link>
        </div>

        <div className="card-elevated p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" /> Student Queries
          </h3>
          <div className="space-y-3">
            {queries.map((q, i) => (
              <div key={i} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{q.student} ({q.class})</span>
                  <span className="text-xs text-muted-foreground">{q.time}</span>
                </div>
                <p className="text-sm text-muted-foreground">{q.query}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-elevated p-5 h-fit">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" /> Announcements
        </h3>
        <div className="space-y-3">
          {announcements.map((a, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.date}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </DashboardLayout>
);

export default TeacherDashboard;
