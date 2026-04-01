import { Link } from 'react-router-dom';
import {
  BookOpen, ClipboardCheck, IndianRupee, PenLine,
  Upload, FileText, Bell, ArrowRight
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';

const features = [
  { icon: ClipboardCheck, title: 'Attendance', desc: 'Track daily attendance with calendar heatmaps and reports' },
  { icon: IndianRupee, title: 'Fee Tracking', desc: 'Manage fee collection, receipts, and defaulter lists' },
  { icon: PenLine, title: 'Marks', desc: 'Enter and analyze marks with auto-grading and trends' },
  { icon: Upload, title: 'Bulk Upload', desc: 'Import student data via Excel/CSV with column mapping' },
  { icon: FileText, title: 'Report Cards', desc: 'Generate and download professional report cards' },
  { icon: Bell, title: 'Parent Alerts', desc: 'Send fee reminders and notices via SMS & Email' },
];

const Landing = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-30">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo className="h-10 w-10" />
          <span className="text-xl font-bold text-foreground">SmartSchool Manager</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/register">
            <Button size="sm" variant="outline">Register</Button>
          </Link>
          <Link to="/login">
            <Button size="sm">Login</Button>
          </Link>
        </div>
      </div>
    </header>

    <section className="container mx-auto px-4 py-20 text-center animate-fade-in">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
        <BookOpen className="w-4 h-4" /> School Management Platform
      </div>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight max-w-3xl mx-auto">
        Complete school management{' '}
        <span className="text-primary">in one place</span>
      </h1>
      <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
        Streamline attendance, fees, marks, and parent communication with a single powerful platform.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/login?role=admin">
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            Login as Admin <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link to="/login?role=teacher">
          <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
            Login as Teacher <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </section>

    <section className="container mx-auto px-4 pb-20">
      <h2 className="text-2xl font-bold text-center mb-10 text-foreground">Everything you need</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} className="card-elevated p-6 animate-slide-up">
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default Landing;
