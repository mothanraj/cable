import { useEffect, useState } from "react";
import {
  Check,
  MapPin,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import {
  activatePlace,
  createPlace,
  deactivatePlace,
  getPlaces,
  updatePlace,
} from "../api/places";
import { normalizeDate } from "../utils/format";

const emptyForm = {
  placeName: "",
};

export default function PlacesPage() {
  const [places, setPlaces] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadPlaces() {
    try {
      setLoading(true);
      setError("");
      const rows = await getPlaces({ includeInactive: true });
      setPlaces(rows);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to load places."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await getPlaces({ includeInactive: true });
        if (!cancelled) {
          setPlaces(rows);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "Unable to load places."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createPlace({
        placeName: form.placeName.trim(),
      });
      setForm(emptyForm);
      setSuccess("Place created successfully.");
      await loadPlaces();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to create place."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(place) {
    setEditingId(place.id);
    setEditingName(place.place_name);
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleRename(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await updatePlace(editingId, {
        placeName: editingName.trim(),
      });
      setEditingId(null);
      setEditingName("");
      setSuccess("Place updated.");
      await loadPlaces();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to update place."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(place) {
    setError("");
    setSuccess("");
    try {
      if (place.is_active) {
        await deactivatePlace(place.id);
        setSuccess(`${place.place_name} deactivated.`);
      } else {
        await activatePlace(place.id);
        setSuccess(`${place.place_name} activated.`);
      }
      await loadPlaces();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Unable to update place."
      );
    }
  }

  return (
    <section className="page page--places">
      <div className="page-header">
        <div>
          <h1>Places</h1>
          <p>Create and manage the places customers are divided into.</p>
        </div>
      </div>

      {success && <p className="success-toast">{success}</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <h2>Create place</h2>
        </div>
        <form
          className="panel-body"
          onSubmit={handleCreate}
        >
          <label className="field">
            <span>Place name</span>
            <input
              className="input"
              value={form.placeName}
              onChange={(event) =>
                setForm({ placeName: event.target.value })
              }
              placeholder="e.g. East Side"
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <Plus size={16} aria-hidden="true" />
            {saving ? "Creating..." : "Create place"}
          </button>
        </form>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted" style={{ padding: 16 }}>
            Loading places...
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {places.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No places yet.
                    </td>
                  </tr>
                )}
                {places.map((place) => (
                  <tr key={place.id}>
                    <td>
                      {editingId === place.id ? (
                        <form
                          className="inline-edit-form"
                          onSubmit={handleRename}
                        >
                          <input
                            className="input"
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            required
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={saving}
                          >
                            <Check
                              size={14}
                              aria-hidden="true"
                            />
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <span className="table-identity">
                          <span
                            className="avatar avatar--sm avatar--place"
                            aria-hidden="true"
                          >
                            <MapPin size={15} />
                          </span>
                          <strong>{place.place_name}</strong>
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          place.is_active
                            ? "status-pill status-paid"
                            : "status-pill status-unpaid"
                        }
                      >
                        {place.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
                    <td>{normalizeDate(place.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        {editingId !== place.id && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(place)}
                          >
                            <Pencil
                              size={14}
                              aria-hidden="true"
                            />
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className={
                            place.is_active
                              ? "btn btn-danger btn-sm"
                              : "btn btn-secondary btn-sm"
                          }
                          onClick={() => toggleActive(place)}
                        >
                          <Power
                            size={14}
                            aria-hidden="true"
                          />
                          {place.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
