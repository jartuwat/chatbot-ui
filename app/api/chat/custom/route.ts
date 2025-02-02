import fetch from "node-fetch"
import https from "https"

export const runtime = "nodejs"

import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"

import { OpenAIStream, StreamingTextResponse } from "ai"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { customModelId } = json as {
      customModelId: string
    }

    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: customModel, error } = await supabaseAdmin
      .from("models")
      .select("*")
      .eq("id", customModelId)
      .single()

    if (!customModel) {
      throw new Error(error.message)
    }

    // Create a custom HTTPS agent that ignores SSL certificate verification
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false // WARNING: This bypasses SSL certificate verification
    })

    const externalApiResponse = await fetch(customModel.base_url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(json),
      agent: httpsAgent // Use the custom agent
    })

    if (!externalApiResponse.ok) {
      throw new Error(
        `HTTP error! status: ${externalApiResponse.status} - ${await externalApiResponse.text()}`
      )
    }

    const response = await externalApiResponse.text()

    if (response.startsWith("{") || response.startsWith("[")) {
      try {
        const jsonResponse = JSON.parse(response) // Attempt to parse if it looks like JSON
        console.log(jsonResponse)
      } catch (error) {
        console.error("Failed to parse JSON:", error)
      }
    } else {
      console.log("Response is plain text:", response) // Handle non-JSON response
    }

    return new Response(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    })
  } catch (error: any) {
    console.error("Detailed error:", error)

    return new Response(
      JSON.stringify({
        error: "An error occurred",
        details: error.message,
        stack: error.stack,
        name: error.name
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
  }
}
