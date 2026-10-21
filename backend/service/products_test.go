package service

import (
	"encoding/json"
	"testing"
)

func TestBilingualProductManagement(t *testing.T) {
	a := testApp(t)
	product := Product{Name: "Example", NameEn: "Practice set", NameFa: "ست تمرین", DescriptionEn: "English description\nSecond line", DescriptionFa: "توضیحات فارسی\nخط دوم", SubtitleEn: "For daily practice", SubtitleFa: "برای تمرین روزانه", Price: 123000, Category: "set", Weight: 120, Stock: 10, Color: "#ab1234", Image: "/assets/cover.png", Images: []string{"/assets/cover.png", "/assets/detail.png"}, Featured: true, Rating: 5}
	send := func(method, path string, p Product) Product {
		t.Helper()
		data, _ := json.Marshal(p)
		w := request(a, method, path, string(data), "")
		if w.Code != 200 {
			t.Fatalf("%s %s: %d %s", method, path, w.Code, w.Body.String())
		}
		var response struct{ Product Product }
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response.Product
	}
	created := send("POST", "adminneda/products", product)
	if created.ID == "" || created.Name != product.NameEn || created.Description != product.DescriptionEn || created.NameFa != product.NameFa || created.DescriptionFa != product.DescriptionFa || created.Rating != 0 || len(created.Images) != 2 {
		t.Fatalf("product did not round trip: %+v", created)
	}
	// The storefront sees the same persisted bilingual copy and image ordering.
	w := request(a, "GET", "products/"+created.ID, "", "")
	var public struct{ Product Product }
	json.Unmarshal(w.Body.Bytes(), &public)
	if w.Code != 200 || public.Product.SubtitleFa != product.SubtitleFa || public.Product.Images[0] != product.Image {
		t.Fatal("storefront fields missing")
	}
	previous := a.state.Products[created.ID]
	previous.Rating = 4.7
	a.state.Products[created.ID] = previous
	created.Image = "/assets/detail.png"
	created.Images = []string{"/assets/detail.png", "/assets/cover.png"}
	created.NameFa = "نام ویرایش‌شده"
	created.Rating = 1
	created.Slug = "changed"
	updated := send("PUT", "adminneda/products/"+created.ID, created)
	if updated.Rating != 4.7 || updated.Slug != previous.Slug || updated.Image != "/assets/detail.png" || updated.NameFa != created.NameFa {
		t.Fatal("update lost identity, reviews or image order")
	}
	updated.Image = ""
	updated.Images = []string{}
	updated = send("PUT", "adminneda/products/"+created.ID, updated)
	if updated.Image != "" || len(updated.Images) != 0 {
		t.Fatal("image removal did not persist")
	}
	for _, mutate := range []func(*Product){func(p *Product) { p.Price = 0 }, func(p *Product) { p.Stock = -1 }, func(p *Product) { p.Weight = 0 }, func(p *Product) { p.Category = "invalid" }, func(p *Product) { p.Images = []string{"javascript:alert(1)"} }, func(p *Product) {
		p.Images = []string{}
		for i := 0; i < 13; i++ {
			p.Images = append(p.Images, "/"+string(rune('a'+i))+".png")
		}
	}} {
		invalid := updated
		mutate(&invalid)
		data, _ := json.Marshal(invalid)
		if result := request(a, "PUT", "adminneda/products/"+updated.ID, string(data), ""); result.Code != 400 {
			t.Fatalf("invalid product accepted: %d", result.Code)
		}
	}
	if result := request(a, "DELETE", "adminneda/products/"+updated.ID, "", ""); result.Code != 200 {
		t.Fatal("delete failed")
	}
	if result := request(a, "GET", "products/"+updated.ID, "", ""); result.Code != 404 {
		t.Fatal("deleted product still visible")
	}
}
