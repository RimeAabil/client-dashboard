import { useEffect, useState } from "react";
import API from "../services/api";
import CreateRequestForm from "../components/CreateRequestForm";
import RequestsTable from "../components/RequestsTable";

export default function Dashboard({ onLogout }) {

    const [requests, setRequests] = useState([]);

    // GET requests
    const fetchRequests = async () => {
        const res = await API.get("/requests");
        setRequests(res.data);
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleLogout = () => {
        // Mock logout — just sends the user back to the Login screen
        onLogout();
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div>
                    <h1>Client Requests Dashboard</h1>
                    <p className="subtitle">Create, view, and update client requests.</p>
                </div>

                <button className="btn-logout" onClick={handleLogout}>
                    Logout
                </button>
            </header>

            <CreateRequestForm refresh={fetchRequests} />

            <RequestsTable requests={requests} refresh={fetchRequests} />
        </div>
    );
}