import DirectoryPage from '../components/DirectoryPage.jsx';

export default function EventsPage() {
    return (
        <DirectoryPage
            title="Events &"
            accent="Competitions"
            lead="Hackathons, competitions and build events at Purdue. Challenge yourself, meet a team, and make something worth putting on the projects board."
            // The filename's spelling is a typo that predates this page, but it is the name of a
            // file already deployed in public/, so it is left alone rather than quietly renamed.
            source="/Competitons.json"
            dataKey="competitions"
            emptyMessage="No events listed yet. Check back soon."
        />
    );
}
