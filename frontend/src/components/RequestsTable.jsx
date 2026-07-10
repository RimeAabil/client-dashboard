import API from "../services/api";

// Cycles a request forward through the status pipeline
const NEXT_STATUS = {
    "New": "In Progress",
    "In Progress": "Done",
    "Done": "Done"
};

export default function RequestsTable({ requests, refresh }) {

    // UPDATE STATUS
    const updateStatus = async (id, currentStatus) => {
        const nextStatus = NEXT_STATUS[currentStatus] || "New";
        await API.put(`/requests/${id}`, { status: nextStatus });
        refresh();
    };

    return (
        <section className="card">
            <h2>Client Requests</h2>

            <table className="requests-table">
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>
                    {requests.map((r) => (
                        <tr key={r.id}>
                            <td>{r.client}</td>
                            <td>{r.title}</td>
                            <td>{r.description}</td>
                            <td>
                                <span className={`status-badge status-${r.status.replace(/\s+/g, "-").toLowerCase()}`}>
                                    {r.status}
                                </span>
                            </td>
                            <td>
                                <button
                                    className="btn-primary"
                                    onClick={() => updateStatus(r.id, r.status)}
                                    disabled={r.status === "Done"}
                                >
                                    Next Status
                                </button>
                            </td>
                        </tr>
                    ))}

                    {requests.length === 0 && (
                        <tr>
                            <td colSpan="5" className="empty-row">
                                ✨ No requests yet — add one above to get started.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
    );
}