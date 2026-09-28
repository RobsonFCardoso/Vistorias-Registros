package com.vistoria.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "NativeMultipleShare")
public class NativeSharePlugin extends Plugin {

    @PluginMethod
    public void shareFiles(PluginCall call) {
        try {
            JSArray files = call.getArray("files");
            String title = call.getString("title", "Compartilhar Vistoria");
            String text = call.getString("text", "");
            String dialogTitle = call.getString("dialogTitle", "Enviar via WhatsApp");

            if (files == null || files.length() == 0) {
                call.reject("Nenhum arquivo fornecido para compartilhamento.");
                return;
            }

            List<Object> filesList = files.toList();
            ArrayList<Uri> contentUris = new ArrayList<>();

            for (Object item : filesList) {
                String filePathOrUri = (String) item;
                if (filePathOrUri == null || filePathOrUri.trim().isEmpty()) {
                    continue;
                }

                File file;
                if (filePathOrUri.startsWith("file://")) {
                    file = new File(Uri.parse(filePathOrUri).getPath());
                } else if (filePathOrUri.startsWith("/")) {
                    file = new File(filePathOrUri);
                } else {
                    file = new File(getContext().getCacheDir(), filePathOrUri);
                }

                if (!file.exists()) {
                    call.reject("Arquivo não encontrado para compartilhamento: " + file.getName());
                    return;
                }

                Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
                contentUris.add(contentUri);
            }

            if (contentUris.isEmpty()) {
                call.reject("Nenhum arquivo válido encontrado para compartilhamento.");
                return;
            }

            Intent shareIntent = new Intent(Intent.ACTION_SEND_MULTIPLE);
            shareIntent.setType("image/*");
            shareIntent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, contentUris);

            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            if (title != null && !title.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            }

            // Garante que o ClipData contenha todos os URIs para concessão de permissão pelo Android
            ClipData clipData = ClipData.newUri(getContext().getContentResolver(), "Vistoria Fotos", contentUris.get(0));
            for (int i = 1; i < contentUris.size(); i++) {
                clipData.addItem(new ClipData.Item(contentUris.get(i)));
            }
            shareIntent.setClipData(clipData);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, dialogTitle);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("sharedCount", contentUris.size());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha no compartilhamento nativo: " + e.getMessage());
        }
    }
}
