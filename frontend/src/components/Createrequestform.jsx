import { useState } from "react";
import API from "../services/api";

export default function CreateRequestForm({ refresh }) {

    const [client, setClient] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!client || !title) return;

        await API.post("/requests", {
            client,
            title,
            description
        });

        setClient("");
        setTitle("");
        setDescription("");

        refresh();
    };

    return (
        <section className="card">
            <h2>Create Request</h2>

            <form className="create-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Client name"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="Request title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <input
                    type="text"
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <button type="submit" className="btn-primary">
                    Add
                </button>
            </form>
        </section>
    );
}