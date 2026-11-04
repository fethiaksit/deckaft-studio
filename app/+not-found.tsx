import { router } from "expo-router";
import { Page, StateView, Button } from "../src/components/ui";
export default function NotFound() {
  return (
    <Page title="Sayfa bulunamadı">
      <StateView
        title="Bu bağlantı artık geçerli değil"
        action={
          <Button title="Ana sayfa" onPress={() => router.replace("/")} />
        }
      />
    </Page>
  );
}
