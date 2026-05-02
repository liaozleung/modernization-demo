using System.Globalization;
using System.Text.Json;

namespace LeungyouErp.Api;

public static class JsonHelpers
{
    public static string? AsString(object? v) => v switch
    {
        null => null,
        string s => s,
        JsonElement je when je.ValueKind == JsonValueKind.String => je.GetString(),
        JsonElement je when je.ValueKind == JsonValueKind.Null   => null,
        JsonElement je => je.ToString(),
        _ => v.ToString()
    };

    public static decimal? AsDecimal(object? v) => v switch
    {
        null => null,
        decimal d => d,
        double d => (decimal)d,
        float f => (decimal)f,
        int i => i,
        long l => l,
        string s when decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var x) => x,
        JsonElement je when je.ValueKind == JsonValueKind.Number => je.GetDecimal(),
        JsonElement je when je.ValueKind == JsonValueKind.String && decimal.TryParse(je.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var x) => x,
        JsonElement je when je.ValueKind == JsonValueKind.Null => null,
        _ => null
    };

    public static int? AsInt(object? v) => AsDecimal(v) is { } d ? (int)d : null;

    public static Dictionary<string, object?> AsDict(object? v)
    {
        if (v is Dictionary<string, object?> d) return d;
        if (v is JsonElement je && je.ValueKind == JsonValueKind.Object)
        {
            var o = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in je.EnumerateObject()) o[p.Name] = p.Value;
            return o;
        }
        return new(StringComparer.OrdinalIgnoreCase);
    }
}
