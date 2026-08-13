import Button from '../components/ui/Button.jsx';
import PageHeader, { PageShell } from '../components/ui/PageHeader.jsx';

// vercel.json rewrites every non-/api path to index.html so the router can handle deep links,
// which means a genuinely wrong URL reaches React rather than the host's own error page. This
// is what it lands on. (The old site handled the same problem with a 404.html redirect shim
// for GitHub Pages, which is gone along with that deployment.)
export default function NotFoundPage() {
    return (
        <PageShell width="max-w-2xl" className="text-center">
            <PageHeader
                title="Page"
                accent="Not Found"
                lead="That page doesn't exist - it may have moved, or the link that brought you here may be out of date."
            />
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button to="/" variant="darkGold">
                    Back to Home
                </Button>
                <Button to="/projects" variant="ghost">
                    Browse Projects
                </Button>
            </div>
        </PageShell>
    );
}
