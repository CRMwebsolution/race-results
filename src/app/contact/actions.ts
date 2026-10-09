"use server";

export async function submitContactForm(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !message) {
    return { error: "Please fill out all fields." };
  }

  try {
    const res = await fetch("https://n8n.southernautomate.com/webhook/a8aecd54-4eb6-4243-9c19-daf7c939c69c", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "contact_form",
        timestamp: new Date().toISOString(),
        data: { name, email, message }
      })
    });

    if (!res.ok) {
      console.error("Webhook responded with status", res.status);
      return { error: "Something went wrong sending your message. Please try again later." };
    }

    return { success: true };
  } catch (error) {
    console.error("Contact form webhook error:", error);
    return { error: "A network error occurred. Please try again." };
  }
}
